import { BOUNDS, GOAL, ITEMS, clamp, dimensions, type Action, type Input, type Kind, type Piece, type Player, type World } from './types';

const FLOOR = .13;
const RADIUS = .32;
const HEIGHT = 1.8;
const GRAVITY = 19;
const SPEED = 4.4;
export const emptyInput = (): Input => ({ x: 0, z: 0, jump: false, seq: 0 });
export function createPlayer(id: string, name: string, color: number, slot: number, now: number): Player {
  return { id, name, color, x: -2.4 + slot*1.5, y: FLOOR, z: 7.8, vy: 0, angle: Math.PI, grounded: true, breath: 8, down: false, rescued: false, seen: now, input: emptyInput(), lastJump: -1 };
}
export function freshWorld(now: number, mode: World['mode'] = 'normal', seed = 1): World {
  const kinds: Kind[] = ['crate','pallet','sofa','crate','fridge','plank','bathtub','crate','pallet'];
  const pieces: Piece[] = [];
  // Generous spacing, an open build area, and a clear spawn corridor.
  for(let row=0;row<5;row++) for(let col=0;col<5;col++) {
    if((row===0&&col===0)||(row===2&&col===2)||(row===4&&col>0&&col<4))continue;
    const index=pieces.length,kind=row===0&&col===1?'crate':kinds[(index+seed)%kinds.length];
    pieces.push({id:`junk-${index}`,kind,x:-7.4+col*3.7,y:FLOOR,z:-7.4+row*3.7,rotation:0,vy:0,tilt:0,unstable:0});
  }
  // Eight second-hand crates arrive already stacked on their supports.
  for(let i=0;i<8;i++){const base=pieces[i];pieces.push({...base,id:`junk-${pieces.length}`,kind:'crate',y:base.y+dimensions(base).h});}
  return {phase:'lobby',mode,started:0,clock:now,water:-.4,pieces,players:[],bestHeight:0,events:[],crane:{owner:null,piece:null,x:0,y:3,z:0},seed};
}
export function emit(world: World, text: string, kind: 'info'|'danger'|'good' = 'info') {
  world.events.push({id:`${world.clock}-${world.events.length}-${text.slice(0,12)}`,text,kind,at:world.clock});
  world.events=world.events.slice(-12);
}
export function waterAt(world: World, now: number) {
  return world.mode==='practice'||!world.started?-.4:Math.min(15,-.4+Math.max(0,(now-world.started)/1000-60)*.025);
}
export function overlaps(x: number,z: number,w: number,d: number,p: Piece,pad=0) {
  const s=dimensions(p);return Math.abs(x-p.x)<(w+s.w)/2-pad && Math.abs(z-p.z)<(d+s.d)/2-pad;
}
export function supportHeight(world: World,x: number,z: number,w: number,d: number,ceiling: number,ignore?: string) {
  let top=FLOOR;
  for(const p of world.pieces) {
    if(p.id===ignore||p.heldBy)continue;
    const h=p.y+dimensions(p).h;
    if(h<=ceiling+.025 && overlaps(x,z,w,d,p,.025))top=Math.max(top,h);
  }
  if(Math.abs(x)<2.35+w/2 && Math.abs(z)<2.35+d/2 && ceiling>=GOAL-.01)top=Math.max(top,GOAL);
  return top;
}
function blocked(world: World,p: Player,x: number,z: number) {
  if(x < -BOUNDS+.4||x>BOUNDS-.4||z<-BOUNDS+.4||z>BOUNDS-.4)return true;
  // The shed and crane base are solid scenery, just as they appear.
  if(x>-9.3-RADIUS && x<-4.7+RADIUS && z>-8.65-RADIUS && z<-5.35+RADIUS && p.y<2.85)return true;
  for(const piece of world.pieces) {
    if(piece.heldBy)continue;
    const s=dimensions(piece);
    if(piece.y+s.h<=p.y+.22 || piece.y>=p.y+HEIGHT-.12)continue;
    if(overlaps(x,z,RADIUS*2,RADIUS*2,piece,.02))return true;
  }
  return false;
}
export function movePlayer(world: World,p: Player,dt: number,input: Input=p.input) {
  if(p.down||p.rescued)return;
  let ix=input.x,iz=input.z;const length=Math.hypot(ix,iz);if(length>1){ix/=length;iz/=length;}
  if(world.crane.owner===p.id){ix=0;iz=0;}
  if(Math.hypot(ix,iz)>.01)p.angle=Math.atan2(ix,iz);
  if(input.jump && input.seq!==p.lastJump && p.grounded){p.vy=8.4;p.grounded=false;p.lastJump=input.seq;}
  const carrying=world.pieces.some(item=>item.heldBy===p.id),speed=SPEED*(carrying?.82:1);
  const nx=p.x+ix*speed*dt,nz=p.z+iz*speed*dt;
  if(!blocked(world,p,nx,p.z))p.x=nx;
  if(!blocked(world,p,p.x,nz))p.z=nz;
  p.vy-=GRAVITY*dt;const oldY=p.y;let nextY=p.y+p.vy*dt;
  const floor=supportHeight(world,p.x,p.z,RADIUS*1.7,RADIUS*1.7,oldY+.23);
  if(p.vy<=0 && nextY<=floor && oldY>=floor-.24){nextY=floor;p.vy=0;p.grounded=true;} else p.grounded=false;
  // Collide with the underside of platforms on ascent.
  if(p.vy>0)for(const piece of world.pieces){if(piece.heldBy)continue;if(overlaps(p.x,p.z,.5,.5,piece)&&oldY+HEIGHT<=piece.y+.03&&nextY+HEIGHT>=piece.y){nextY=piece.y-HEIGHT;p.vy=0;}}
  p.y=Math.max(FLOOR,nextY);
  if(p.y<=FLOOR){p.grounded=true;p.vy=0;}
}
function advancePieces(world: World,dt: number) {
  const sorted=[...world.pieces].sort((a,b)=>a.y-b.y);
  for(const p of sorted) {
    const size=dimensions(p);
    if(p.heldBy){
      if(p.heldBy==='crane'){p.x=world.crane.x;p.y=world.crane.y;p.z=world.crane.z;}
      else {const holder=world.players.find(a=>a.id===p.heldBy);if(!holder||holder.down){delete p.heldBy;continue;}p.x=holder.x;p.y=holder.y+2.05;p.z=holder.z;}
      p.vy=0;p.tilt=0;p.unstable=0;continue;
    }
    const floor=supportHeight(world,p.x,p.z,size.w,size.d,p.y+.03,p.id);
    if(p.y>floor+.025){p.vy-=GRAVITY*dt;p.y=Math.max(floor,p.y+p.vy*dt);p.tilt*=.95;if(p.y===floor)p.vy=0;}
    else {p.y=floor;p.vy=0;}
    if(p.y>FLOOR+.05 && Math.abs(p.y-GOAL)>.03){
      const supports=world.pieces.filter(s=>s.id!==p.id&&!s.heldBy&&Math.abs(s.y+dimensions(s).h-p.y)<.04&&overlaps(p.x,p.z,size.w,size.d,s));
      const stable=supports.some(s=>{const d=dimensions(s);return Math.abs(p.x-s.x)<d.w*.46 && Math.abs(p.z-s.z)<d.d*.46;});
      const bridge=supports.length>1&&p.x>=Math.min(...supports.map(s=>s.x))&&p.x<=Math.max(...supports.map(s=>s.x))&&p.z>=Math.min(...supports.map(s=>s.z))-.15&&p.z<=Math.max(...supports.map(s=>s.z))+.15;
      if(supports.length&&!stable&&!bridge){
        p.unstable+=dt;p.tilt=Math.sin(p.unstable*8)*Math.min(.13,p.unstable*.055);
        if(p.unstable>1.5){const s=supports[0];let dx=p.x-s.x,dz=p.z-s.z;const len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;p.x=clamp(p.x+dx*dt*1.5,-9,9);p.z=clamp(p.z+dz*dt*1.5,-9,9);}
      }else {p.unstable=0;p.tilt*=.8;}
    } else {p.unstable=0;p.tilt*=.8;}
  }
}
export function tick(world: World,now: number) {
  if(now<=world.clock)return world;
  const elapsed=Math.min((now-world.clock)/1000,2);world.clock=now;
  if(world.phase==='won'||world.phase==='lost')return world;
  world.water=waterAt(world,now);
  const count=Math.ceil(elapsed/(1/45)),dt=elapsed/count;
  for(let step=0;step<count;step++){
    advancePieces(world,dt);
    for(const p of world.players){
      movePlayer(world,p,dt,now-p.seen>750?emptyInput():p.input);
      if(world.phase==='playing'){
        if(world.water>p.y+1.5){p.breath=Math.max(0,p.breath-dt);if(p.breath===0&&!p.down){p.down=true;p.input=emptyInput();emit(world,`${p.name} needs a rescue!`,'danger');releasePlayer(world,p.id);}}
        else p.breath=Math.min(8,p.breath+dt*2);
        if(p.down)p.y=Math.max(p.y,world.water-1.2);
        if(!p.down&&p.y>=GOAL-.04&&Math.abs(p.x)<2.3&&Math.abs(p.z)<2.3){p.rescued=true;world.phase='won';emit(world,`${p.name} reached rescue. The whole crew is coming home!`,'good');return world;}
      }
    }
  }
  world.bestHeight=Math.max(world.bestHeight,...world.pieces.filter(p=>!p.heldBy&&p.vy===0).map(p=>p.y+dimensions(p).h-FLOOR));
  if(world.phase==='playing'&&world.players.length&&world.players.every(p=>p.down)){world.phase='lost';emit(world,'The water won this round. Build it better.','danger');}
  return world;
}
export function releasePlayer(world: World,id: string) {
  for(const piece of world.pieces)if(piece.heldBy===id)delete piece.heldBy;
  if(world.crane.owner===id){const p=world.pieces.find(p=>p.id===world.crane.piece);if(p)delete p.heldBy;world.crane.owner=null;world.crane.piece=null;}
}
export function nearestPiece(world: World,p: Player) {
  return world.pieces.filter(item=>!item.heldBy&&Math.hypot(item.x-p.x,item.z-p.z)<3.8&&item.y<p.y+2.8&&item.y+dimensions(item).h>p.y-1.4).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
}
export function placement(world: World,p: Player,item: Piece,x: number,z: number) {
  const d=dimensions(item);x=Math.round(x*4)/4;z=Math.round(z*4)/4;
  const y=supportHeight(world,x,z,d.w,d.d,p.y+2.25,item.id);
  let error: string|null=null;
  if(Math.hypot(x-p.x,z-p.z)>4.3)error='Move a little closer to place it.';
  else if(Math.abs(x)+d.w/2>9.8||Math.abs(z)+d.d/2>9.8)error='Keep your salvage inside the yard.';
  else if(x-d.w/2 < -4.7 && x+d.w/2 > -9.3 && z-d.d/2 < -5.35 && z+d.d/2 > -8.65 && y<2.85)error='The shed is in the way.';
  else if(world.players.some(a=>!a.down&&Math.abs(a.x-x)<d.w/2+.34&&Math.abs(a.z-z)<d.d/2+.34&&a.y<y+d.h-.05&&a.y+HEIGHT>y+.05))error='Someone is standing there.';
  else if(world.pieces.some(s=>s.id!==item.id&&!s.heldBy&&overlaps(x,z,d.w,d.d,s,.035)&&s.y<y+d.h-.04&&s.y+dimensions(s).h>y+.04))error='There is another piece in the way.';
  return {x,y,z,error};
}
export function act(world: World,id: string,action: Action,host: string) {
  const p=world.players.find(p=>p.id===id);if(!p)throw new Error('Rejoin the crew to play.');
  if(action.type==='start'||action.type==='restart'){
    if(id!==host)throw new Error('Only the crew captain can start a round.');
    if(action.type==='start'&&world.phase!=='lobby')return;
    const next=freshWorld(world.clock,world.mode,world.seed);next.phase='playing';next.started=world.clock;
    next.players=world.players.map((a,i)=>createPlayer(a.id,a.name,a.color,i,world.clock));Object.assign(world,next);emit(world,world.mode==='practice'?'Practice run. Take your time.':'One minute before the tide turns. Start stacking!','good');return;
  }
  if(world.phase==='won'||world.phase==='lost')throw new Error('Start another round to keep building.');
  if(p.down)throw new Error('Call a teammate over. They can rescue you with F.');
  const held=world.pieces.find(item=>item.heldBy===id);
  if(action.type==='grab'){
    if(held)throw new Error('Place what you are carrying first.');
    if(world.crane.owner===id)throw new Error('Release the crane first.');
    const item=action.target?world.pieces.find(s=>s.id===action.target):nearestPiece(world,p);
    if(!item||item.heldBy)throw new Error('Move close to a piece of junk and press E.');
    if(Math.hypot(item.x-p.x,item.z-p.z)>4.3||item.y>p.y+2.8||item.y+dimensions(item).h<p.y-1.4)throw new Error('That piece is out of reach.');
    item.heldBy=id;item.vy=0;item.unstable=0;return;
  }
  if(action.type==='place'){
    if(!held)throw new Error('Pick up a piece of junk first.');
    if(!Number.isFinite(action.x)||!Number.isFinite(action.z))throw new Error('Choose a place inside the yard.');
    const spot=placement(world,p,held,action.x!,action.z!);if(spot.error)throw new Error(spot.error);
    Object.assign(held,{x:spot.x,y:spot.y,z:spot.z,vy:0});delete held.heldBy;emit(world,`${p.name} placed ${ITEMS[held.kind].name.toLowerCase()}.`);return;
  }
  if(action.type==='rotate'){
    const item=held||(world.crane.owner===id?world.pieces.find(s=>s.id===world.crane.piece):undefined);
    if(!item)throw new Error('Pick up a piece before rotating it.');item.rotation=(item.rotation+1)%4;return;
  }
  if(action.type==='rescue'){
    const teammate=world.players.find(s=>s.down&&Math.hypot(s.x-p.x,s.z-p.z)<4&&Math.abs(s.y-p.y)<5);
    if(!teammate)throw new Error('Get within four metres of a teammate who needs help.');
    Object.assign(teammate,{down:false,breath:8,x:p.x+.65,z:p.z,y:p.y+1,vy:0,grounded:false});emit(world,`${p.name} rescued ${teammate.name}!`,'good');return;
  }
  if(action.type==='crane'){
    if(held)throw new Error('Place your salvage before taking the crane.');
    if(world.crane.owner){if(world.crane.owner===id){releasePlayer(world,id);return;}throw new Error('A teammate is using the crane.');}
    const item=action.target?world.pieces.find(s=>s.id===action.target):nearestPiece(world,p);
    if(!item||item.heldBy)throw new Error('Click a piece of salvage, then take the crane.');
    world.crane={owner:id,piece:item.id,x:item.x,y:item.y+.3,z:item.z};item.heldBy='crane';emit(world,`${p.name} has the crane. Mind your heads!`);return;
  }
  if(action.type==='crane-move'){
    if(world.crane.owner!==id)throw new Error('Take the crane first.');
    for(const key of ['x','y','z'] as const)if(!Number.isFinite(action[key]))throw new Error('Invalid crane movement.');
    world.crane.x=clamp(world.crane.x+clamp(action.x!,-1,1),-8,8);world.crane.z=clamp(world.crane.z+clamp(action.z!,-1,1),-8,8);
    world.crane.y=clamp(world.crane.y+clamp(action.y!,-1,1),FLOOR,Math.min(GOAL+1,world.bestHeight+2.2));return;
  }
  if(action.type==='crane-drop'){
    if(world.crane.owner!==id)throw new Error('Take the crane first.');
    const load=world.pieces.find(item=>item.id===world.crane.piece);
    if(load){const size=dimensions(load);const surface=supportHeight(world,world.crane.x,world.crane.z,size.w,size.d,GOAL+4,load.id);if(surface>world.crane.y+.04)throw new Error('Raise the load above the stack before releasing it.');Object.assign(load,{x:world.crane.x,y:world.crane.y,z:world.crane.z});}
    releasePlayer(world,id);emit(world,'Delivery incoming. Clear the landing zone!');return;
  }
  if(action.type==='wave'){emit(world,`${p.name}: Over here!`);return;}
  throw new Error('Unknown game action.');
}
