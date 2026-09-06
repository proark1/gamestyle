import assert from 'node:assert/strict';
import {placement} from '../game/simulation.ts';
const origin=process.env.GAME_TEST_URL||'http://localhost:3010',sessions=[];
async function request(body,expected=200){const response=await fetch(`${origin}/api/rooms`,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});const reply=await response.json();assert.equal(response.status,expected,JSON.stringify(reply));return reply;}
async function action(session,action){return request({op:'action',...session,requestId:crypto.randomUUID(),action});}
try{
  const first=await request({op:'create',name:'Physics captain'});sessions.push(first.session);
  const joiners=await Promise.all(['Physics two','Physics three','Physics four'].map(name=>request({op:'join',code:first.session.code,name})));sessions.push(...joiners.map(r=>r.session));
  const captain=sessions[0];await action(captain,{type:'start'});
  await request({op:'sync',...captain,input:{x:0,z:-1,jump:false,seq:1}});
  await new Promise(resolve=>setTimeout(resolve,500));
  const moved=await request({op:'sync',...captain,input:{x:0,z:0,jump:false,seq:1}});
  const source=moved.snapshot.world.pieces.find(p=>p.kind==='bathtub'&&Math.abs(p.x+3.7)<.2&&Math.abs(p.z-3.7)<.2);assert.ok(source,'test bathtub exists');
  const grabbed=await action(captain,{type:'grab',target:source.id});
  const w=grabbed.snapshot.world,player=w.players.find(p=>p.id===captain.id),held=w.pieces.find(p=>p.id===source.id);
  const support=w.pieces.find(p=>p.kind==='crate'&&Math.abs(p.x)<.2&&Math.abs(p.z-3.7)<.2);assert.ok(support,'test support exists');
  const ghost=placement(w,player,held,support.x,support.z);assert.equal(ghost.error,null);
  const placed=await action(captain,{type:'place',target:held.id,rotation:held.rotation,revision:held.revision,...ghost});
  const actual=placed.snapshot.world.pieces.find(p=>p.id===held.id);
  for(const key of ['x','y','z'])assert.ok(actual[key]===ghost[key],`${key} must match the preview exactly`);
  assert.equal(actual.heldBy,undefined);
  await new Promise(resolve=>setTimeout(resolve,650));
  const observer=await request({op:'sync',...sessions[1]});const shared=observer.snapshot.world.pieces.find(p=>p.id===held.id);
  assert.equal(observer.snapshot.world.players.length,4);assert.equal(shared.kind,'bathtub');assert.equal(shared.heldBy,undefined);
  for(const key of ['x','y','z'])assert.ok(Math.abs(shared[key]-ghost[key])<.07,`${key}: stack must settle on its support for another client`);
  console.log('PASS: four live clients, carry a bathtub, commit the exact preview onto a crate, and observe the settled stack from another client.');
}finally{await Promise.all(sessions.map(session=>request({op:'leave',...session}).catch(()=>{})));}
