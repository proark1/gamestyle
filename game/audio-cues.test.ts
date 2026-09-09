import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioCues } from './audio-cues';
import type { AudioSink, Bark, Click, Cue, Material } from './audio';
import { emptyInput } from './simulation';
import type { GameEvent, Piece, Player, World } from './types';

class Recorder implements AudioSink {
  calls:{name:string;args:unknown[]}[]=[];
  ambience=0;submersion=0;intensity=0;crane=false;
  private log=(name:string,...args:unknown[])=>{this.calls.push({name,args});};
  count(name:string){return this.calls.filter(c=>c.name===name).length;}
  first(name:string){return this.calls.find(c=>c.name===name);}
  impact(material:Material,energy:number,x:number,y:number,z:number){this.log('impact',material,energy,x,y,z);}
  creak(intensity:number,x:number,y:number,z:number){this.log('creak',intensity,x,y,z);}
  footstep(material:Material,energy:number,x:number,y:number,z:number){this.log('footstep',material,energy,x,y,z);}
  splash(size:number,x:number,y:number,z:number){this.log('splash',size,x,y,z);}
  clank(x:number,y:number,z:number){this.log('clank',x,y,z);}
  heft(material:Material,heavy:number,x:number,y:number,z:number){this.log('heft',material,heavy,x,y,z);}
  gasp(){this.log('gasp');}
  heartbeat(strength:number){this.log('heartbeat',strength);}
  klaxon(){this.log('klaxon');}
  sting(win:boolean){this.log('sting',win);}
  call(x:number,y:number,z:number){this.log('call',x,y,z);}
  bark(kind:Bark,colour:number,x:number,y:number,z:number){this.log('bark',kind,colour,x,y,z);}
  cue(kind:Cue){this.log('cue',kind);}
  event(e:GameEvent,localId:string){this.log('event',e.tag,localId);}
  click(kind:Click){this.log('click',kind);}
  setListener(){}
  setAmbience(level:number){this.ambience=level;}
  setSubmersion(level:number){this.submersion=level;}
  setCrane(active:boolean){this.crane=active;}
  setIntensity(level:number){this.intensity=level;}
  update(){}
}

const VIEW={x:0,y:2,z:0,yaw:0};
const world=(over:Partial<World>={}):World=>({phase:'playing',mode:'normal',started:1000,clock:1000,water:-.4,pieces:[],players:[],bestHeight:0,events:[],crane:{owner:null,piece:null,x:0,y:3,z:0},seed:1,...over});
const piece=(over:Partial<Piece>={}):Piece=>({id:'a',kind:'crate',x:0,y:.13,z:0,rotation:0,vy:0,tilt:0,unstable:0,...over});
const player=(over:Partial<Player>={}):Player=>({id:'me',name:'Me',color:0,x:0,y:.13,z:0,vy:0,angle:0,grounded:true,breath:8,down:false,rescued:false,seen:0,input:emptyInput(),lastJump:-1,...over});

test('a falling piece lands once, with force taken from the speed it lost',()=>{
  const audio=new Recorder(),cues=new AudioCues(audio);
  const falling=piece({y:4,vy:-5.2});
  cues.observe(world({pieces:[falling],players:[player()]}),'me',null,VIEW,1000,true);
  assert.equal(audio.count('impact'),0,'joining mid-round does not replay the yard');
  const landed=piece({y:.13,vy:0,sleeping:true});
  cues.observe(world({pieces:[landed],players:[player()]}),'me',null,VIEW,1200,true);
  assert.equal(audio.count('impact'),1);
  const hit=audio.first('impact')!;
  assert.equal(hit.args[0],'wood');
  assert.ok((hit.args[1] as number)>.6&&(hit.args[1] as number)<=1,'a 5.2 m/s drop is most of full force');
  cues.observe(world({pieces:[landed],players:[player()]}),'me',null,VIEW,1600,true);
  assert.equal(audio.count('impact'),1,'a settled piece does not keep landing');
});

test('walking makes footsteps that take their material from the surface underfoot',()=>{
  const audio=new Recorder(),cues=new AudioCues(audio);
  const fridge=piece({id:'f',kind:'fridge'});
  const at=(x:number,time:number)=>cues.observe(world({pieces:[fridge],players:[player({x,y:1.93})]}),'me',null,VIEW,time,true);
  at(0,1000);at(.8,1100);
  assert.equal(audio.count('footstep'),0,'half a stride is not a step');
  at(0,1200);
  assert.equal(audio.count('footstep'),1);
  assert.equal(audio.first('footstep')!.args[0],'metal','standing on the fridge, not the dirt');
});

test('breath running down is heard, and the flood announces itself once',()=>{
  const audio=new Recorder(),cues=new AudioCues(audio);
  const drowning={pieces:[],players:[player({y:0,breath:5})]};
  cues.observe(world({...drowning,clock:31000}),'me',null,VIEW,1000,true);
  assert.ok(audio.count('heartbeat')>=1,'a short breath raises a pulse');
  assert.equal(audio.count('klaxon'),0,'the tide has not turned yet');
  cues.observe(world({...drowning,clock:61500,water:.5}),'me',null,VIEW,2000,true);
  assert.equal(audio.count('klaxon'),1);
  cues.observe(world({...drowning,clock:62000,water:.6}),'me',null,VIEW,3000,true);
  assert.equal(audio.count('klaxon'),1,'the klaxon does not repeat every frame');
  assert.ok(audio.submersion>0,'a submerged player hears the yard through the water');
});

test('picking salvage up and hooking it to the crane sound different',()=>{
  const audio=new Recorder(),cues=new AudioCues(audio);
  const held=(heldBy?:string)=>world({pieces:[piece({kind:'fridge',heldBy})],players:[player()]});
  cues.observe(held(),'me',null,VIEW,1000,true);
  cues.observe(held('me'),'me',null,VIEW,1200,true);
  assert.equal(audio.count('heft'),1);
  assert.equal(audio.first('heft')!.args[0],'metal');
  cues.observe(held(),'me',null,VIEW,1400,true);
  cues.observe(held('crane'),'me',null,VIEW,1600,true);
  assert.equal(audio.count('clank'),1);
  assert.equal(audio.count('heft'),1,'the crane does not grunt');
});

test('the round result and the rising water drive the music, not a timer',()=>{
  const audio=new Recorder(),cues=new AudioCues(audio);
  cues.observe(world({phase:'lobby',players:[player()]}),'me',null,VIEW,1000,true);
  const calm=audio.intensity;
  cues.observe(world({players:[player({y:0})],water:9,clock:9000}),'me',null,VIEW,2000,true);
  assert.ok(audio.intensity>calm,'a rising flood lifts the bed');
  cues.observe(world({phase:'won',players:[player()],clock:9500}),'me',null,VIEW,3000,true);
  assert.equal(audio.count('sting'),1);
  assert.equal(audio.first('sting')!.args[0],true);
  assert.equal(audio.intensity,0,'the bed drops out under the result');
});
