import assert from 'node:assert/strict';
const origin=process.env.GAME_TEST_URL||'http://localhost:3000';
const sessions=[];
async function request(body,expected=200){const response=await fetch(`${origin}/api/rooms`,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;}
try{
  const creator=await request({op:'create',name:'Integration captain',color:0});sessions.push(creator.session);assert.equal(creator.snapshot.world.phase,'lobby');
  const joiners=await Promise.all(['Builder two','Builder three','Builder four'].map(name=>request({op:'join',name,code:creator.session.code})));joiners.forEach(r=>sessions.push(r.session));
  const snapshot=await request({op:'sync',...creator.session});assert.equal(snapshot.snapshot.world.players.length,4);
  await request({op:'join',name:'Extra builder',code:creator.session.code},409);
  await request({op:'sync',...creator.session,token:'wrong-token'},401);
  await request({op:'action',...sessions[1],requestId:crypto.randomUUID(),action:{type:'start'}},400);
  const start=await request({op:'action',...creator.session,requestId:crypto.randomUUID(),action:{type:'start'}});assert.equal(start.snapshot.world.phase,'playing');
  const spawn=start.snapshot.world.players.find(p=>p.id===creator.session.id);
  const input={x:0,z:-1,jump:false,seq:1};await request({op:'sync',...creator.session,input});
  await new Promise(resolve=>setTimeout(resolve,220));
  const moved=await request({op:'sync',...creator.session,input:{...input,z:0}});const player=moved.snapshot.world.players.find(p=>p.id===creator.session.id);assert.ok(player.z<spawn.z-.2,'server movement should advance from input');
  const actionId=crypto.randomUUID();await request({op:'action',...creator.session,requestId:actionId,action:{type:'wave'}});const repeat=await request({op:'action',...creator.session,requestId:actionId,action:{type:'wave'}});assert.equal(repeat.snapshot.world.events.filter(e=>e.text.includes('Over here!')).length,1);
  const badOrigin=await fetch(`${origin}/api/rooms`,{method:'POST',headers:{'content-type':'application/json',origin:'https://different.example'},body:JSON.stringify({op:'create'})});assert.equal(badOrigin.status,403);
  console.log('PASS: live HTTP create, four clients, capacity, authentication, host control, movement, idempotency and origin validation.');
}finally{await Promise.all(sessions.map(session=>request({op:'leave',...session}).catch(()=>{})));}
