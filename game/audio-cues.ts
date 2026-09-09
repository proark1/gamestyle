import { GOAL, clamp, dimensions, type Player, type World } from './types';
import { FLOOR, PIECE_MASS } from './geometry';
import { topOf } from './physics';
import { materialOf, type AudioSink, type Material } from './audio';

export type View={x:number;y:number;z:number;yaw:number};

const STRIDE=1.55;       // metres of travel between footsteps
const QUIET=1.15;        // impacts slower than this are not worth hearing
const FULL_IMPACT=7;     // metres per second that reads as a full-force hit
const HIT_GAP=110, CREAK_GAP=900;

/**
 * Turns snapshot deltas into sound. The authoritative physics runs on the server in
 * multiplayer, so every cue here is derived from state the client already receives —
 * velocities, sleep flags, breath and grounded transitions — and nothing is added to
 * the wire format.
 */
export class AudioCues {
  private speed=new Map<string,number>();
  private asleep=new Map<string,boolean>();
  private wet=new Map<string,boolean>();
  private hitAt=new Map<string,number>();
  private walked=new Map<string,number>();
  private spot=new Map<string,{x:number;z:number}>();
  private airborne=new Map<string,boolean>();
  private fall=new Map<string,number>();
  private under=new Map<string,boolean>();
  private downed=new Map<string,boolean>();
  private held=new Map<string,string>();
  private crew=new Set<string>();
  private beatAt=0;private creakAt=0;private gasped=false;
  private started=-1;private phase='';private flooded=false;private first=true;
  constructor(private audio:AudioSink){}

  /** Keeps per-piece history from leaking across rounds, where ids are reused. */
  reset(){
    for(const map of [this.speed,this.asleep,this.wet,this.hitAt,this.walked,this.spot,this.airborne,this.fall,this.under,this.downed,this.held])map.clear();
    this.beatAt=0;this.creakAt=0;this.gasped=false;
  }
  clear(){this.reset();this.crew.clear();this.started=-1;this.phase='';this.flooded=false;this.first=true;}

  observe(world:World,localId:string,local:Player|null,view:View,now:number,changed:boolean){
    // Round detection first: it clears per-entity history, so it must not run after the
    // frame's own observations have been written.
    if(changed)this.round(world);
    this.audio.setListener(view.x,view.y,view.z,view.yaw);
    const me=local||world.players.find(p=>p.id===localId)||null;
    const eye=me?me.y:view.y;
    // The sea is always out there; it gets louder as it climbs toward you.
    this.audio.setAmbience(clamp(1.05-(eye-world.water)/16,.14,1));
    const submersion=me&&!me.rescued?clamp((world.water-(me.y+.35))/1.5,0,1):0;
    this.audio.setSubmersion(submersion);
    this.audio.setIntensity(this.intensity(world,me));
    this.audio.setCrane(!!world.crane.owner,world.crane.x,world.crane.y,world.crane.z);
    this.audio.update();
    for(const p of world.players)this.steps(world,p,p.id===localId&&local?local:p);
    this.breath(me,now,submersion);
    if(!changed)return;
    this.pieces(world,now);
    this.people(world);
    this.first=false;
  }

  private intensity(world:World,me:Player|null){
    if(world.phase==='won'||world.phase==='lost')return 0;
    if(world.phase==='lobby')return .12;
    if(world.mode==='practice')return .22;
    const flood=clamp(world.water/GOAL,0,1);
    const peril=me&&!me.down?clamp(1-(me.y-world.water)/9,0,1):1;
    return clamp(.25+flood*.5+peril*.25,0,1);
  }

  private steps(world:World,p:Player,shown:Player){
    const previous=this.spot.get(p.id);
    this.spot.set(p.id,{x:shown.x,z:shown.z});
    if(!previous||p.down||p.rescued)return;
    const moved=Math.hypot(shown.x-previous.x,shown.z-previous.z);
    if(moved>1.2)return; // a rescue or respawn teleport, not a stride
    const airborne=!p.grounded,was=this.airborne.get(p.id)??airborne;
    this.airborne.set(p.id,airborne);
    if(airborne){
      this.fall.set(p.id,Math.min(this.fall.get(p.id)??0,p.vy));
      this.walked.set(p.id,(this.walked.get(p.id)||0)+moved);
      return;
    }
    if(was){
      // p.vy is already zeroed by the time we see the landing, so use the worst of the fall.
      const drop=clamp(Math.abs(this.fall.get(p.id)||0)/7,.3,1);
      this.fall.set(p.id,0);this.walked.set(p.id,0);
      this.audio.footstep(this.surface(world,shown),drop,shown.x,shown.y,shown.z);
      return;
    }
    const walked=(this.walked.get(p.id)||0)+moved;
    if(walked<STRIDE){this.walked.set(p.id,walked);return;}
    this.walked.set(p.id,walked-STRIDE);
    this.audio.footstep(this.surface(world,shown),.55,shown.x,shown.y,shown.z);
  }

  /** What the player is standing on, so timber and sheet metal do not sound alike. */
  private surface(world:World,p:Player):Material{
    if(p.y<FLOOR+.25)return 'ground';
    let best:Material='ground',closest=.45;
    for(const piece of world.pieces){
      if(piece.heldBy)continue;
      const size=dimensions(piece);
      if(Math.abs(p.x-piece.x)>size.w/2+.4||Math.abs(p.z-piece.z)>size.d/2+.4)continue;
      const drop=p.y-topOf(piece);
      if(drop>-.12&&drop<closest){closest=drop;best=materialOf(piece.kind);}
    }
    return best;
  }

  private pieces(world:World,now:number){
    for(const piece of world.pieces){
      const speed=Math.hypot(piece.vx||0,piece.vy||0,piece.vz||0);
      const before=this.speed.get(piece.id)??speed;
      const sleeping=!!piece.sleeping,wasAsleep=this.asleep.get(piece.id)??sleeping;
      this.speed.set(piece.id,speed);this.asleep.set(piece.id,sleeping);
      if(!piece.heldBy&&!this.first){
        const landed=(sleeping&&!wasAsleep)||speed<before*.45;
        if(landed&&before>=QUIET&&now-(this.hitAt.get(piece.id)||0)>HIT_GAP){
          this.hitAt.set(piece.id,now);
          this.audio.impact(materialOf(piece.kind),clamp(before/FULL_IMPACT,0,1),piece.x,piece.y,piece.z);
        }
        // A loaded stack complains before it goes. One voice at a time, or it turns to mush.
        if(!sleeping&&(piece.unstable>.35||Math.abs(piece.tilt)>.12)&&now-this.creakAt>CREAK_GAP){
          this.creakAt=now;this.audio.creak(clamp(piece.unstable,.2,1),piece.x,piece.y,piece.z);
        }
      }
      // heldBy transitions cover picking up, and the crane taking or dropping a load.
      const holder=piece.heldBy||'',wasHeld=this.held.get(piece.id)??holder;
      this.held.set(piece.id,holder);
      if(holder!==wasHeld&&!this.first){
        if(holder==='crane'||wasHeld==='crane')this.audio.clank(piece.x,piece.y,piece.z);
        else if(holder)this.audio.heft(materialOf(piece.kind),(PIECE_MASS[piece.kind]-12)/53,piece.x,piece.y,piece.z);
      }
      const wet=piece.y<world.water,wasWet=this.wet.get(piece.id)??wet;
      this.wet.set(piece.id,wet);
      if(wet&&!wasWet&&!piece.heldBy&&!this.first&&before>.6)this.audio.splash(clamp(before/6,.25,1),piece.x,world.water,piece.z);
    }
  }

  private people(world:World){
    for(const p of world.players){
      const under=world.water>p.y+.35,wasUnder=this.under.get(p.id)??under;
      this.under.set(p.id,under);
      if(under!==wasUnder&&!p.down&&!this.first)this.audio.splash(under?.55:.35,p.x,world.water,p.z);
      const wasDown=this.downed.get(p.id)??p.down;
      this.downed.set(p.id,p.down);
      if(p.down&&!wasDown&&!this.first)this.audio.splash(.85,p.x,world.water,p.z);
    }
    const ids=new Set(world.players.map(p=>p.id));
    if(this.crew.size&&!this.first){
      for(const id of ids)if(!this.crew.has(id))this.audio.click('confirm');
      for(const id of this.crew)if(!ids.has(id))this.audio.click('tap');
    }
    this.crew=ids;
  }

  private breath(me:Player|null,now:number,submersion:number){
    if(!me||me.down||me.rescued||me.breath>=6.5){this.beatAt=0;this.gasped=false;return;}
    const urgency=clamp(1-me.breath/6.5,0,1);
    if(now-this.beatAt>760-urgency*380){this.beatAt=now;this.audio.heartbeat(urgency);}
    if(me.breath>3)this.gasped=false;
    else if(submersion>.2&&me.breath<2.2&&!this.gasped){this.gasped=true;this.audio.gasp();}
  }

  private round(world:World){
    const elapsed=world.started?(world.clock-world.started)/1000:0;
    if(world.started!==this.started){this.started=world.started;this.reset();this.flooded=elapsed>=60;}
    if(!this.flooded&&world.mode==='normal'&&world.phase==='playing'&&elapsed>=60){this.flooded=true;this.audio.klaxon();}
    if(world.phase!==this.phase){
      if(!this.first&&world.phase==='won')this.audio.sting(true);
      if(!this.first&&world.phase==='lost')this.audio.sting(false);
      this.phase=world.phase;
    }
  }
}
