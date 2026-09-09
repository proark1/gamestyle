import * as T from 'three';
import { box, island, junk, label, worker } from './objects';
import { previewPieces } from './preview';
import { emptyInput, movePlayer, nearestPiece, placement, supportHeight } from './simulation';
import { orientation, topOf } from './physics';
import { AudioCues } from './audio-cues';
import type { AudioSink } from './audio';
import { COLORS, GOAL, ITEMS, clamp, dimensions, type Action, type Input, type Piece, type Player, type Snapshot } from './types';

export type Hud = { target: string; carrying: string; placementError: string|null; height: number; crane: boolean };
type Callbacks = { input:(i:Input)=>void; action:(a:Action)=>void; hud:(h:Hud)=>void; error:(s:string)=>void; audio:AudioSink };
export class GameScene {
  renderer:T.WebGLRenderer;scene=new T.Scene();camera=new T.OrthographicCamera();water:T.Mesh;
  resize:ResizeObserver;abort=new AbortController();frameId=0;last=0;time=0;lastHud=0;lastInput=0;lastCrane=0;
  pieces=new Map<string,T.Group>();actors=new Map<string,T.Group>();preview=new T.Group();world:Snapshot|null=null;localId='';predicted:Player|null=null;
  keys=new Set<string>();touch={x:0,z:0};jumpSeq=0;jumpHeld=false;paused=false;menu=true;overview=false;yaw=.65;zoom=1;target=new T.Vector3();
  pointer=new T.Vector2(-20,-20);ray=new T.Raycaster();pointerActive=false;selected:string|null=null;drag:{id:number;x:number;y:number;moved:boolean}|null=null;
  ghost:T.Group|null=null;ghostKind='';ghostSpot:{x:number;y:number;z:number;error:string|null;target:string;rotation:number;revision:number}|null=null;
  scenery:T.Group;lastGhost=0;cues:AudioCues;audioVersion=-1;ghostError:boolean|null=null;
  ring=new T.Mesh(new T.RingGeometry(.65,.73,40),new T.MeshBasicMaterial({color:'#ffe181',side:T.DoubleSide,depthTest:false,transparent:true,opacity:.95}));
  hook=new T.Group();rope=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),new T.LineBasicMaterial({color:'#526f63'}));
  seaLines=new T.Group();reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;projectionDirty=true;
  constructor(public host:HTMLElement,public callbacks:Callbacks){
    this.cues=new AudioCues(callbacks.audio);
    const mobile=matchMedia('(pointer:coarse)').matches;
    this.renderer=new T.WebGLRenderer({antialias:!mobile,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.3:1.8));
    this.renderer.shadowMap.enabled=!mobile;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.3;
    this.renderer.domElement.setAttribute('aria-label','Stack or Sink 3D yard. Use WASD to move, Space to jump, E to pick up or place, R to rotate, C for crane, F to rescue.');this.renderer.domElement.tabIndex=0;host.appendChild(this.renderer.domElement);
    this.scene.background=new T.Color('#b7d0c3');this.scene.fog=new T.Fog('#b7d0c3',65,120);this.scene.add(new T.HemisphereLight('#fff2d4','#7fa497',3));
    const sun=new T.DirectionalLight('#fff1d2',3.3);sun.position.set(-13,24,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25});sun.shadow.normalBias=.05;this.scene.add(sun);
    this.scenery=island();this.scene.add(this.scenery);this.water=new T.Mesh(new T.PlaneGeometry(250,250),new T.MeshStandardMaterial({color:'#73b5b1',roughness:.38,metalness:.05,transparent:true,opacity:.86}));this.water.rotation.x=-Math.PI/2;this.scene.add(this.water);
    for(let i=0;i<60;i++){const m=new T.Mesh(new T.PlaneGeometry(.5+(i%4)*.4,.035),new T.MeshBasicMaterial({color:'#d0e2cf',transparent:true,opacity:.35,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(Math.sin(i*12.7)*42,0,Math.cos(i*7.8)*42);this.seaLines.add(m);}this.scene.add(this.seaLines);
    this.scene.add(this.preview);this.makePreview();this.ring.rotation.x=-Math.PI/2;this.ring.renderOrder=10;this.ring.visible=false;this.scene.add(this.ring);
    box(this.hook,[.4,.25,.4],[0,0,0],'#d0a13b');box(this.hook,[.13,.35,.13],[0,-.2,0],'#63766b');this.scene.add(this.hook,this.rope);this.hook.visible=this.rope.visible=false;
    this.resize=new ResizeObserver(()=>{this.projectionDirty=true;});this.resize.observe(host);
    const signal=this.abort.signal;
    window.addEventListener('keydown',this.keyDown,{signal});window.addEventListener('keyup',this.keyUp,{signal});window.addEventListener('blur',this.clearInput,{signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clearInput();},{signal});
    host.addEventListener('pointerdown',this.pointerDown,{signal});host.addEventListener('pointermove',this.pointerMove,{signal});host.addEventListener('pointerup',this.pointerUp,{signal});host.addEventListener('pointercancel',()=>{this.drag=null;},{signal});
    host.addEventListener('contextmenu',e=>e.preventDefault(),{signal});host.addEventListener('wheel',e=>{if(this.menu)return;e.preventDefault();this.zoom=clamp(this.zoom+e.deltaY*.0007,.6,1.7);this.projectionDirty=true;},{passive:false,signal});
    host.addEventListener('webglcontextlost',e=>{e.preventDefault();callbacks.error('The 3D view was interrupted. Reload the page to reconnect.');},{signal});
    this.frameId=requestAnimationFrame(this.frame);
  }
  makePreview(){
    for(const p of previewPieces()){const m=junk(p.kind);m.position.set(p.x,p.y+.13,p.z);m.rotation.y=p.rotation*Math.PI/2;this.preview.add(m);}
    for(let i=0;i<4;i++){const a=worker(i);a.position.set([2,-2.2,1.5,-4][i],[.13,.13,6.99,.13][i],[3,2,1,4][i]);a.rotation.y=[-1.3,.8,.5,.4][i];this.preview.add(a);}
  }
  setSnapshot(snapshot:Snapshot,id:string,local=false){
    const previous=this.world;this.world=snapshot;this.localId=id;this.menu=false;this.preview.visible=false;
    const player=snapshot.world.players.find(p=>p.id===id);
    if(player){
      if(!this.predicted||!previous||snapshot.world.started!==previous.world.started||Math.hypot(this.predicted.x-player.x,this.predicted.z-player.z)>1.8||player.down||player.rescued){this.predicted=structuredClone(player);this.jumpSeq=Math.max(this.jumpSeq,player.lastJump);}
      else {const p=this.predicted;p.x=T.MathUtils.lerp(p.x,player.x,.22);p.z=T.MathUtils.lerp(p.z,player.z,.22);if((p.grounded&&player.grounded)||Math.abs(p.y-player.y)>1.2){p.y=player.y;p.vy=player.vy;p.grounded=player.grounded;}p.down=player.down;p.breath=player.breath;}
    }
    if(!previous)this.projectionDirty=true;
    for(const [pid,m] of this.pieces)if(!snapshot.world.pieces.some(p=>p.id===pid&&p.kind===m.userData.kind)){m.removeFromParent();this.disposeObject(m);this.pieces.delete(pid);}
    for(const p of snapshot.world.pieces)if(!this.pieces.has(p.id)){const m=junk(p.kind);m.userData.kind=p.kind;m.userData.pieceId=p.id;m.traverse(o=>o.userData.pieceId=p.id);this.pieces.set(p.id,m);m.position.set(p.x,p.y,p.z);this.scene.add(m);}
    for(const p of snapshot.world.pieces){const before=previous?.world.pieces.find(a=>a.id===p.id);if(before&&(before.heldBy!==p.heldBy||before.revision!==p.revision)){const mesh=this.pieces.get(p.id)!;mesh.position.set(p.x,p.y,p.z);mesh.quaternion.copy(orientation(p));}}
    for(const [pid,m] of this.actors)if(!snapshot.world.players.some(p=>p.id===pid)){this.scene.remove(m);this.disposeObject(m);this.actors.delete(pid);}
    for(const p of snapshot.world.players)if(!this.actors.has(p.id)){
      const m=worker(p.color);const name=label(`${p.name}${p.id===id?' · YOU':''}`,p.id===id?'#fff2b7':'#edf1de','#345449',2);name.position.y=2.35;m.add(name);m.userData.name=name;m.position.set(p.x,p.y,p.z);this.actors.set(p.id,m);this.scene.add(m);
    }
  }
  resetMenu(){this.cues.clear();this.audioVersion=-1;this.ghostError=null;this.world=null;this.predicted=null;this.menu=true;this.preview.visible=true;this.clearInput();this.ghost?.removeFromParent();this.ghost=null;this.ghostKind='';for(const m of this.pieces.values()){m.removeFromParent();this.disposeObject(m);}this.pieces.clear();for(const m of this.actors.values()){m.removeFromParent();this.disposeObject(m);}this.actors.clear();this.ring.visible=false;this.hook.visible=false;this.rope.visible=false;this.projectionDirty=true;}
  setPaused(paused:boolean){this.paused=paused;if(paused)this.clearInput();}
  clearInput=()=>{this.keys.clear();this.touch={x:0,z:0};this.jumpHeld=false;this.callbacks.input({...emptyInput(),seq:this.jumpSeq});};
  keyDown=(e:KeyboardEvent)=>{
    if(this.menu||this.paused||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
    this.keys.add(e.code);if(e.repeat)return;
    if(e.code==='Space'){this.jumpSeq++;this.jumpHeld=true;}
    if(e.code==='KeyE')this.interact();if(e.code==='KeyR')this.callbacks.action({type:'rotate'});if(e.code==='KeyC')this.crane();if(e.code==='KeyF')this.callbacks.action({type:'rescue'});if(e.code==='KeyV')this.toggleOverview();if(e.code==='KeyG')this.callbacks.action({type:'wave'});
  };
  keyUp=(e:KeyboardEvent)=>{this.keys.delete(e.code);if(e.code==='Space')this.jumpHeld=false;};
  pointerDown=(e:PointerEvent)=>{if(this.menu||this.paused)return;this.pointerMove(e);this.updateGhost();this.host.setPointerCapture(e.pointerId);this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};};
  pointerMove=(e:PointerEvent)=>{
    const r=this.host.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.pointerActive=e.pointerType!=='touch';
    if(this.drag&&this.drag.id===e.pointerId){const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.abs(dx)+Math.abs(dy)>3)this.drag.moved=true;if(this.drag.moved){this.yaw-=dx*.006;this.drag.x=e.clientX;this.drag.y=e.clientY;this.projectionDirty=true;}}
  };
  pointerUp=(e:PointerEvent)=>{
    const clicked=this.drag&&!this.drag.moved;this.drag=null;
    if(clicked){if(this.world?.world.pieces.some(p=>p.heldBy===this.localId))this.interact();else{this.pointerMove(e);const hit=this.pick();if(hit)this.selected=hit.id;}}
    if(this.host.hasPointerCapture(e.pointerId))this.host.releasePointerCapture(e.pointerId);
  };
  toggleOverview(){this.overview=!this.overview;this.projectionDirty=true;}
  jump(){this.jumpSeq++;this.jumpHeld=true;setTimeout(()=>{this.jumpHeld=false;},180);}
  input():Input{
    if(this.paused)return {...emptyInput(),seq:this.jumpSeq};
    const horizontal=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0)+this.touch.x;
    const vertical=(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)+this.touch.z;
    const length=Math.max(1,Math.hypot(horizontal,vertical));
    return {x:(horizontal*Math.cos(this.yaw)+vertical*Math.sin(this.yaw))/length,z:(-horizontal*Math.sin(this.yaw)+vertical*Math.cos(this.yaw))/length,jump:this.jumpHeld,seq:this.jumpSeq};
  }
  pick(){
    this.ray.setFromCamera(this.pointer,this.camera);const hits=this.ray.intersectObjects([...this.pieces.values()],true);
    const hit=hits.find(h=>{const p=this.world?.world.pieces.find(p=>p.id===h.object.userData.pieceId);return p&&!p.heldBy;});
    return hit?{id:hit.object.userData.pieceId as string,point:hit.point}:null;
  }
  currentTarget(){
    if(!this.world||!this.predicted)return;
    const hit=this.pointerActive?this.pick():null;
    const selected=this.world.world.pieces.find(p=>p.id===(hit?.id||this.selected)&&!p.heldBy);
    if(selected)return selected;return nearestPiece(this.world.world,this.predicted);
  }
  interact(){
    if(!this.world||this.paused)return;
    if(this.world.world.crane.owner===this.localId){this.callbacks.action({type:'crane-drop'});return;}
    if(this.world.world.pieces.some(p=>p.heldBy===this.localId)){
      const spot=this.ghostSpot;if(spot){if(spot.error){this.callbacks.error(spot.error);return;}this.callbacks.action({type:'place',x:spot.x,y:spot.y,z:spot.z,target:spot.target,rotation:spot.rotation,revision:spot.revision});}
    }else this.callbacks.action({type:'grab',target:this.currentTarget()?.id});
  }
  crane(){this.callbacks.action({type:'crane',target:this.currentTarget()?.id});}
  updateGhost(){
    if(!this.world||!this.predicted)return;const held=this.world.world.pieces.find(p=>p.heldBy===this.localId);
    if(!held){if(this.ghost)this.ghost.visible=false;this.ghostSpot=null;this.ghostError=null;return;}
    if(this.ghostKind!==held.kind){if(this.ghost){this.ghost.removeFromParent();this.disposeObject(this.ghost,true);}this.ghost=junk(held.kind);this.ghost.traverse(o=>{if(o instanceof T.Mesh){o.material=(o.material as T.MeshStandardMaterial).clone();Object.assign(o.material,{transparent:true,opacity:.42,depthWrite:false});o.castShadow=false;if(o.userData.surface)o.add(new T.LineSegments(new T.EdgesGeometry(o.geometry,25),new T.LineBasicMaterial({color:'#347844',transparent:true,opacity:.9,depthTest:false})));}});this.scene.add(this.ghost);this.ghostKind=held.kind;}
    let x=this.predicted.x+Math.sin(this.predicted.angle)*2.9,z=this.predicted.z+Math.cos(this.predicted.angle)*2.9;
    if(this.drag)return;
    if(this.pointerActive){this.scene.updateMatrixWorld(true);this.ray.setFromCamera(this.pointer,this.camera);const hit=this.ray.intersectObjects([this.scenery,...this.pieces.values()],true).find(hit=>hit.object.userData.surface&&!this.world!.world.pieces.some(p=>p.id===hit.object.userData.pieceId&&p.heldBy));if(hit){const support=this.world.world.pieces.find(p=>p.id===hit.object.userData.pieceId);x=support?.x??hit.point.x;z=support?.z??hit.point.z;}else{const v=new T.Vector3();if(this.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-this.predicted.y),v)){x=v.x;z=v.z;}}}
    const player=this.world.world.players.find(p=>p.id===this.localId)!;
    this.ghostSpot={...placement(this.world.world,player,held,x,z),target:held.id,rotation:held.rotation,revision:held.revision||0};const spot=this.ghostSpot;this.ghost!.visible=true;this.ghost!.position.set(spot.x,spot.y,spot.z);this.ghost!.rotation.y=held.rotation*Math.PI/2;
    this.ghost!.traverse(o=>{if(o instanceof T.Mesh)(o.material as T.MeshStandardMaterial).color.set(spot.error?'#de6b53':'#91cf8a');if(o instanceof T.LineSegments)(o.material as T.LineBasicMaterial).color.set(spot.error?'#ba3623':'#347844');});
    // A click on the flip lets players aim without watching the ghost.
    const invalid=!!spot.error;if(this.ghostError!==null&&this.ghostError!==invalid)this.callbacks.audio.click('tick');this.ghostError=invalid;
  }
  updateCamera(dt:number){
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;const aspect=w/h;
    if(this.projectionDirty){this.renderer.setSize(w,h,false);const size=(this.menu?(aspect<1?20:17):this.overview?17:aspect<1?11:9)*this.zoom;Object.assign(this.camera,{left:-size*aspect,right:size*aspect,top:size,bottom:-size,near:.1,far:180});this.camera.updateProjectionMatrix();this.projectionDirty=false;}
    const p=this.predicted;const desired=this.menu?new T.Vector3(aspect>1.1?-5:0,4,0):this.overview?new T.Vector3(0,5,0):new T.Vector3(p?.x||0,(p?.y||0)+2.2,p?.z||0);
    this.target.lerp(desired,this.menu?1:1-Math.exp(-dt*6));const distance=42;this.camera.position.set(this.target.x+Math.sin(this.yaw)*distance,this.target.y+distance*.8,this.target.z+Math.cos(this.yaw)*distance);this.camera.lookAt(this.target);
  }
  frame=(now:number)=>{
    const dt=Math.min((now-(this.last||now))/1000,.05);this.last=now;this.time+=dt;
    if(this.world&&this.predicted){
      const world=this.world.world,input=this.input();
      if(!this.paused&&world.phase!=='won'&&world.phase!=='lost')movePlayer(world,this.predicted,dt,input);
      if(now-this.lastInput>70){this.callbacks.input(input);this.lastInput=now;}
      if(world.crane.owner===this.localId&&!this.paused&&now-this.lastCrane>160){const y=(this.keys.has('KeyQ')?1:0)-(this.keys.has('KeyZ')?1:0);if(Math.hypot(input.x,input.z)+Math.abs(y)>.1){this.callbacks.action({type:'crane-move',x:input.x*.55,z:input.z*.55,y:y*.6});this.lastCrane=now;}}
      for(const p of world.pieces){const m=this.pieces.get(p.id);if(!m)continue;let x=p.x,y=p.y,z=p.z;if(p.heldBy===this.localId){x=this.predicted.x;y=this.predicted.y+2.1;z=this.predicted.z;}m.position.lerp(new T.Vector3(x,y,z),1-Math.exp(-dt*24));const q=orientation(p);m.quaternion.slerp(new T.Quaternion(q.x,q.y,q.z,q.w),1-Math.exp(-dt*24));}
      for(const p of world.players){const m=this.actors.get(p.id);if(!m)continue;const shown=p.id===this.localId?this.predicted:p;const move=Math.hypot(m.position.x-shown.x,m.position.z-shown.z)>.015;m.position.lerp(new T.Vector3(shown.x,shown.y,shown.z),p.id===this.localId?1:1-Math.exp(-dt*14));m.rotation.y=shown.angle;
        const body=m.userData.body as T.Group;body.rotation.z=p.down?Math.PI/2:this.reduceMotion?0:Math.sin(this.time*2+p.color)*.02;
        const swing=move&&!p.down?Math.sin(this.time*13)*.65:0;m.userData.legL.rotation.x=swing;m.userData.legR.rotation.x=-swing;
        const carrying=world.pieces.some(j=>j.heldBy===p.id);m.userData.armL.rotation.x=carrying?-2.65:-swing*.7;m.userData.armR.rotation.x=carrying?-2.65:swing*.7;
      }
      this.updateCamera(dt);if(now-this.lastGhost>45){this.updateGhost();this.lastGhost=now;}const item=this.currentTarget();this.ring.visible=!!item&&!world.pieces.some(p=>p.heldBy===this.localId);
      if(item)this.ring.position.set(item.x,topOf(item)+.03,item.z);
      this.hook.visible=this.rope.visible=!!world.crane.owner;
      if(world.crane.owner){const c=world.crane;const piece=world.pieces.find(p=>p.id===c.piece);const bottom=c.y+(piece?dimensions(piece).h:0)+.4;this.hook.position.set(c.x,bottom,c.z);this.rope.geometry.setFromPoints([new T.Vector3(c.x,16,c.z),new T.Vector3(c.x,bottom,c.z)]);}
      const changed=this.world.version!==this.audioVersion;if(changed)this.audioVersion=this.world.version;
      const ear=this.predicted;this.cues.observe(world,this.localId,this.predicted,{x:ear.x,y:ear.y+1.5,z:ear.z,yaw:this.yaw},now,changed);
      if(now-this.lastHud>130){this.callbacks.hud({target:item?ITEMS[item.kind].name:'',carrying:world.pieces.find(p=>p.heldBy===this.localId)?.kind||'',placementError:this.ghostSpot?.error||null,height:this.predicted.y-.13,crane:world.crane.owner===this.localId});this.lastHud=now;}
    }
    if(this.menu){this.callbacks.audio.setListener(0,3,0,this.yaw);this.callbacks.audio.setAmbience(.34);this.callbacks.audio.setSubmersion(0);this.callbacks.audio.setIntensity(.12);this.callbacks.audio.update();}
    const sea=this.world?.world.water??-.35;this.water.position.y=sea+(this.reduceMotion?0:Math.sin(this.time*.7)*.025);this.seaLines.position.y=this.water.position.y+.03;
    if(!this.reduceMotion)this.seaLines.position.x=Math.sin(this.time*.13)*.5;
    if(!this.world||!this.predicted)this.updateCamera(dt);this.renderer.render(this.scene,this.camera);this.frameId=requestAnimationFrame(this.frame);
  };
  disposeObject(object:T.Object3D,materials=false){object.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments)o.geometry.dispose();if(o instanceof T.Sprite){o.material.map?.dispose();o.material.dispose();}if((materials&&o instanceof T.Mesh)||o instanceof T.LineSegments){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
  dispose(){cancelAnimationFrame(this.frameId);this.abort.abort();this.resize.disconnect();this.clearInput();this.disposeObject(this.scene);this.renderer.dispose();this.renderer.domElement.remove();}
}
