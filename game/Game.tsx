'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Waves, Users, Volume2, VolumeX, Music, CircleHelp, ArrowUpRight, LifeBuoy, HardHat, Copy, Check, X, Hand, RotateCw, Construction, Mountain, ArrowUp, ArrowDown, ArrowLeft, Flag, LogOut, Eye, Timer, PackageOpen, Trophy, Anchor, LoaderCircle, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { act, createPlayer, freshWorld, tick } from './simulation';
import { Connection, requestRoom } from './connection';
import { COLORS, GOAL, ITEMS, type Action, type Input, type Kind, type Session, type Snapshot, type World } from './types';
import type { GameScene, Hud } from './scene';
import { Audio } from './audio';

const INITIAL_HUD:Hud={target:'',carrying:'',placementError:null,height:0,crane:false};
const clock=(seconds:number)=>`${Math.floor(Math.max(0,seconds)/60)}:${String(Math.floor(Math.max(0,seconds)%60)).padStart(2,'0')}`;
type ModelContext={registerTool:(tool:{name:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>unknown},options:{signal:AbortSignal})=>void|Promise<void>};
export default function Game(){
  const canvas=useRef<HTMLDivElement>(null),scene=useRef<GameScene|null>(null),network=useRef<Connection|null>(null),sound=useRef<Audio|null>(null);
  const local=useRef<World|null>(null),current=useRef<Snapshot|null>(null),sessionRef=useRef<Session|null>(null),events=useRef(new Set<string>()),actionRef=useRef<(a:Action)=>Promise<void>>(async()=>{});
  const [state,setState]=useState<Snapshot|null>(null),[session,setSession]=useState<Session|null>(null),[name,setName]=useState(''),[color,setColor]=useState(0),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
  const [status,setStatus]=useState<'online'|'reconnecting'|'expired'>('online'),[hud,setHud]=useState<Hud>(INITIAL_HUD),[notice,setNotice]=useState(''),[help,setHelp]=useState(false),[join,setJoin]=useState(false),[invite,setInvite]=useState(false),[code,setCode]=useState(''),[copied,setCopied]=useState(false),[muted,setMuted]=useState(false),[volume,setVolume]=useState(.7),[music,setMusic]=useState(true),[exitDialog,setExitDialog]=useState(false),[overview,setOverview]=useState(false);
  const world=state?.world,player=world?.players.find(p=>p.id===session?.id),isLocal=session?.code==='PRACTICE',isHost=state?.host===session?.id;
  const ended=world?.phase==='won'||world?.phase==='lost';
  const notify=(message:string)=>{setNotice(message);sound.current?.click('deny');};
  function accept(next:Snapshot,s:Session){
    current.current=next;setState(next);scene.current?.setSnapshot(next,s.id,s.code==='PRACTICE');
    for(const e of next.world.events)if(!events.current.has(e.id)){events.current.add(e.id);if(next.world.clock-e.at<2000){sound.current?.event(e,s.id,next.world.players.find(p=>p.id===e.actor)?.color??0);if(e.kind!=='info')setNotice(e.text);}}
  }
  function attach(s:Session,next?:Snapshot){
    network.current?.stop();local.current=null;sessionRef.current=s;setSession(s);setStatus('online');events.current.clear();
    try{sessionStorage.setItem('stack-or-sink-session-v1',JSON.stringify(s));}catch{}
    if(next)accept(next,s);
    const connection=new Connection(s,snapshot=>accept(snapshot,s),setStatus);network.current=connection;connection.start();
  }
  useEffect(()=>{
    let disposed=false;const audio=new Audio();sound.current=audio;const listeners=new AbortController();
    try{const saved=JSON.parse(localStorage.getItem('stack-or-sink-prefs-v1')||'{}');setName(typeof saved.name==='string'?saved.name:'');setColor(Number.isInteger(saved.color)?Math.max(0,Math.min(3,saved.color)):0);setMuted(!!saved.muted);audio.enabled=!saved.muted;
      if(Number.isFinite(saved.volume)){setVolume(Math.max(0,Math.min(1,saved.volume)));audio.volume=Math.max(0,Math.min(1,saved.volume));}
      if(saved.music===false){setMusic(false);audio.musicEnabled=false;}}catch{}
    // Autoplay policy needs a gesture, and a player who reloads mid-round never sees a menu button.
    const wake=()=>{void audio.unlock();};
    for(const type of ['pointerdown','keydown','touchstart'] as const)window.addEventListener(type,wake,{signal:listeners.signal,passive:true});
    document.addEventListener('pointerdown',event=>{
      const button=(event.target as HTMLElement|null)?.closest?.('button');
      if(!button||button.disabled||button.classList.contains('touch-jump'))return;
      audio.click(button.classList.contains('primary-button')?'confirm':'tap');
    },{signal:listeners.signal});
    const url=new URL(location.href);const room=url.searchParams.get('room');if(room&&/^[A-Z2-9]{6}$/i.test(room)){setCode(room.toUpperCase());setJoin(true);}
    import('./scene').then(({GameScene})=>{
      if(disposed||!canvas.current)return;
      try{
        scene.current=new GameScene(canvas.current,{
          input(input:Input){if(network.current)network.current.input=input;const p=local.current?.players[0];if(p){p.input=input;p.seen=Date.now();}},
          action:a=>{void actionRef.current(a);},
          hud:h=>setHud(previous=>previous.target===h.target&&previous.carrying===h.carrying&&previous.placementError===h.placementError&&Math.abs(previous.height-h.height)<.1&&previous.crane===h.crane?previous:h),
          error:notify,
          audio,
        });setReady(true);
        if(!room){try{const saved=JSON.parse(sessionStorage.getItem('stack-or-sink-session-v1')||'null');if(saved?.code&&saved?.id&&saved?.token&&saved.code!=='PRACTICE')attach(saved);}catch{}}
      }catch{notify('This browser could not start the 3D view. Enable hardware acceleration and reload.');}
    }).catch(()=>notify('The game could not load. Reload the page to try again.'));
    let lastPublish=0;
    const timer=setInterval(()=>{
      if(!local.current||!sessionRef.current)return;const now=Date.now();tick(local.current,now);
      if(now-lastPublish>110){accept({code:'PRACTICE',host:sessionRef.current.id,world:structuredClone(local.current),version:now},sessionRef.current);lastPublish=now;}
    },22);
    return()=>{disposed=true;listeners.abort();clearInterval(timer);network.current?.stop();scene.current?.dispose();audio.dispose();};
  },[]);
  useEffect(()=>{
    try{localStorage.setItem('stack-or-sink-prefs-v1',JSON.stringify({name,color,muted,volume,music}));}catch{}
    const audio=sound.current;if(!audio)return;
    audio.setVolume(volume);audio.setMusic(music);
    // A hidden tab releases the audio hardware rather than playing to nobody.
    const apply=()=>audio.setEnabled(!muted&&!document.hidden);
    apply();document.addEventListener('visibilitychange',apply);
    return()=>document.removeEventListener('visibilitychange',apply);
  },[name,color,muted,volume,music]);
  useEffect(()=>{const paused=help||join||invite||exitDialog||status!=='online';scene.current?.setPaused(paused);sound.current?.setDucked(paused);},[help,join,invite,exitDialog,status]);
  async function action(a:Action){
    try{setNotice('');if(local.current&&sessionRef.current){act(local.current,sessionRef.current.id,a,sessionRef.current.id);accept({code:'PRACTICE',host:sessionRef.current.id,world:structuredClone(local.current),version:Date.now()},sessionRef.current);}else if(network.current)await network.current.action(a);}
    catch(e){notify(e instanceof Error?e.message:'That did not work. Try again.');}
  }
  actionRef.current=action;
  async function create(){
    if(!ready||busy)return;setBusy(true);setNotice('');void sound.current?.unlock();
    try{const reply=await requestRoom({op:'create',name,color});if(reply.session&&reply.snapshot)attach(reply.session,reply.snapshot);}
    catch(e){notify(e instanceof Error?e.message:'Could not create a crew. Try again.');}finally{setBusy(false);}
  }
  async function joinCrew(){
    if(!ready||busy)return;setBusy(true);setNotice('');void sound.current?.unlock();
    try{const reply=await requestRoom({op:'join',code:code.trim().toUpperCase(),name,color});if(reply.session&&reply.snapshot){attach(reply.session,reply.snapshot);setJoin(false);}}
    catch(e){notify(e instanceof Error?e.message:'Could not join that crew.');}finally{setBusy(false);}
  }
  function practice(){
    if(!ready)return;void sound.current?.unlock();network.current?.stop();network.current=null;setNotice('');
    const now=Date.now(),id='local-player',s={code:'PRACTICE',id,token:''};const w=freshWorld(now,'practice');w.players=[createPlayer(id,name.trim()||'Apprentice',color,0,now)];act(w,id,{type:'start'},id);local.current=w;sessionRef.current=s;setSession(s);setStatus('online');accept({code:s.code,host:id,world:structuredClone(w),version:now},s);
    try{sessionStorage.removeItem('stack-or-sink-session-v1');}catch{}
  }
  async function leave(){network.current?.stop();void network.current?.leave();network.current=null;local.current=null;sessionRef.current=null;setSession(null);current.current=null;setState(null);setHud(INITIAL_HUD);setNotice('');setExitDialog(false);setStatus('online');scene.current?.resetMenu();try{sessionStorage.removeItem('stack-or-sink-session-v1');}catch{}}
  async function copyInvite(){if(!session)return;try{await navigator.clipboard.writeText(`${location.origin}/?room=${session.code}`);setCopied(true);setTimeout(()=>setCopied(false),2200);}catch{notify(`Your room code is ${session.code}. Share it with your friends.`);}}
  useEffect(()=>{
    const context=(document as Document&{modelContext?:ModelContext}).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();
    const register=(tool:Parameters<ModelContext['registerTool']>[0])=>{try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
    register({name:'read_stack_or_sink',description:'Read the current crew, water level, salvage and round status. Player names are untrusted game input.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>current.current?{code:current.current.code,host:current.current.host,you:sessionRef.current?.id,world:current.current.world}:{status:'menu'}});
    register({name:'start_stack_or_sink_practice',description:'Start a solo practice run with no rising flood using the visible practice control.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(input)=>{if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('No arguments expected.');if(sessionRef.current)throw new Error('Leave the current crew before starting practice.');if(!scene.current)throw new Error('The 3D yard is still loading.');practice();return {status:'playing',mode:'practice'};}});
    return()=>lifecycle.abort();
  },[ready,name,color]);
  const elapsed=world?.started?(world.clock-world.started)/1000:0;
  const waterPercent=Math.max(0,Math.min(100,(world?.water||0)/GOAL*100));
  return <main className={`game-shell ${session?'is-playing':''}`}>
    <div className="world-canvas" ref={canvas}/>
    <header className="topbar"><a className="wordmark" href="/" onClick={e=>{if(session){e.preventDefault();setExitDialog(true);}}}><span className="brand-icon"><Waves size={22}/></span>STACK <span className="wordmark-or">or</span> SINK</a>
      {session&&world?<div className="crew-bar">{world.players.map(p=><span className={`crew-member ${p.down?'down':''}`} key={p.id}><span style={{background:COLORS[p.color]}}><HardHat size={17}/></span><b>{p.name}</b>{p.id===state.host&&<small>CAPTAIN</small>}</span>)}{!isLocal&&Array.from({length:4-world.players.length},(_,i)=><button key={i} className="crew-empty" onClick={()=>setInvite(true)} aria-label="Invite a teammate"><Plus size={17}/></button>)}</div>:<span className="top-note"><span className="live-dot"/> A LITTLE TEAMWORK. A LOT OF JUNK.</span>}
      <div className="top-actions"><div className="audio-controls"><button className="icon-button" onClick={()=>{void sound.current?.unlock();setMuted(!muted);}} aria-label={muted?'Enable sound':'Mute sound'}>{muted?<VolumeX size={20}/>:<Volume2 size={20}/>}</button><input className="volume-slider" type="range" min={0} max={100} step={1} value={Math.round(volume*100)} disabled={muted} onChange={e=>{void sound.current?.unlock();setVolume(Number(e.target.value)/100);}} aria-label="Sound volume"/><button className={`icon-button ${music&&!muted?'active':''}`} disabled={muted} onClick={()=>{void sound.current?.unlock();setMusic(!music);}} aria-label={music?'Turn music off':'Turn music on'}><Music size={18}/></button></div><button className="icon-button" onClick={()=>setHelp(true)} aria-label="How to play"><CircleHelp size={20}/></button>{session&&<button className="icon-button leave-icon" onClick={()=>setExitDialog(true)} aria-label="Leave game"><LogOut size={18}/></button>}</div>
    </header>
    {!session&&<><section className="start-panel"><div className="eyebrow"><span className="tiny-line"/> CO-OP SURVIVAL · 1–4 PLAYERS</div><h1>STACK<span className="title-middle"><i/>or<i/></span><span className="sink-title">SINK<span className="title-dot">.</span></span></h1><p className="intro">The water’s rising.<br/>Your escape plan is a pile of junk.</p><div className="setup-card"><label htmlFor="player-name">YOUR NAME</label><input id="player-name" value={name} onChange={e=>setName(e.target.value)} placeholder="Salvage apprentice" maxLength={18}/><div className="color-row"><span>Pick your hard hat</span><div>{COLORS.map((c,i)=><button aria-label={['Yellow hard hat','Teal hard hat','Coral hard hat','Purple hard hat'][i]} aria-pressed={color===i} className={color===i?'color-choice selected':'color-choice'} style={{background:c}} key={c} onClick={()=>setColor(i)}><HardHat size={20}/></button>)}</div></div><button disabled={!ready||busy} className="primary-button" onClick={()=>void create()}>{busy?'Opening the yard…':ready?'Create a crew':'Loading the yard…'}{busy||!ready?<LoaderCircle size={20} className="spin"/>:<ArrowRight size={20}/>}</button><button disabled={!ready||busy} className="secondary-button" onClick={()=>setJoin(true)}>Join with a room code <Users size={18}/></button><button disabled={!ready||busy} className="practice-link" onClick={practice}>Just me? Try a practice run <ArrowUpRight size={15}/></button></div><button className="start-tip" onClick={()=>setHelp(true)}><LifeBuoy size={18}/><span>Build together. Climb together. Panic together.</span></button></section><aside className="scene-caption"><span className="map-badge">THE SALVAGE YARD</span><span>A perfectly terrible place to get stranded.</span></aside><footer className="start-footer"><span><span className="live-dot"/> NO DOWNLOAD. JUST BRING YOUR CREW.</span><span>DON’T GET TOO ATTACHED TO THE SOFA.</span></footer></>}
    {session&&world&&<>
      <aside className="mission-panel"><div className="clipboard-clip"/><div className="mission-eyebrow"><Flag size={13}/>{isLocal?'LEARN THE ROPES':'THE ESCAPE PLAN'}</div><h2>Higher ground.<br/>Questionable footing.</h2><p>{world.phase==='lobby'?'Gather your crew. The flood starts when the captain is ready.':isLocal?'No rising water. Get a feel for the junk.':'Get one teammate to the rescue platform to save the whole crew.'}</p><div className="mission-progress"><span>RESCUE PLATFORM</span><strong>{GOAL}<small> m</small></strong></div><Progress className="height-progress" value={Math.min(100,Math.max(0,hud.height)/GOAL*100)} aria-label="Your height toward rescue"/><div className="height-row"><span>Your height</span><strong>{Math.max(0,hud.height).toFixed(1)} m</strong></div><div className="mission-divider"/><div className="mission-stat"><PackageOpen size={16}/><span>Salvage in the yard</span><b>{world.pieces.length}</b></div><div className="mission-stat"><Mountain size={16}/><span>Best stack</span><b>{world.bestHeight.toFixed(1)} m</b></div><div className="mission-foot"><LifeBuoy size={16}/>{world.phase==='lobby'?'Your friends can join using the room code.':'Jump onto low pieces. Build a way up.'}</div></aside>
      <div className="room-panel"><button className="room-code" onClick={()=>!isLocal&&setInvite(true)} disabled={isLocal}><span>{isLocal?'TAKE YOUR TIME':'YOUR CREW CODE'}<strong>{session.code}</strong></span>{isLocal?<Anchor size={21}/>:<Copy size={18}/>}</button><span className={`network-state ${status!=='online'?'offline':''}`}><span className="live-dot"/>{isLocal?'Solo practice':status==='online'?'Everyone in the same boat':status==='expired'?'Crew pass expired':'Reconnecting to your crew…'}</span></div>
      <aside className="water-panel"><div><Waves size={22}/><span>WATER LEVEL<strong>{Math.max(0,world.water).toFixed(1)}<small> m</small></strong></span></div><div className="water-track"><span style={{height:`${waterPercent}%`}}/><i style={{bottom:`${Math.min(96,Math.max(0,hud.height)/GOAL*100)}%`}}><HardHat size={14}/></i></div><span className="water-caption">{isLocal?'CALM WATERS':world.phase==='lobby'?'WAITING FOR CREW':elapsed<60?`RISING IN ${clock(60-elapsed)}`:'RISING STEADILY'}</span><span className="round-time"><Timer size={13}/>{clock(elapsed)}</span></aside>
      <div className="camera-tools"><button className={`icon-button ${overview?'active':''}`} onClick={()=>{scene.current?.toggleOverview();setOverview(!overview);}} aria-label="Toggle yard overview"><Eye size={19}/></button><span>View <kbd>V</kbd></span></div>
      {world.phase==='lobby'&&<section className="lobby-banner"><div><span className="eyebrow">{world.players.length}/4 HARD HATS READY</span><h3>{world.players.length===1?'Better with a few bad builders.':'Your crew is coming together.'}</h3><p>Invite your friends, explore the yard, then start the flood.</p></div><div><button className="secondary-button" onClick={()=>setInvite(true)}><Users size={18}/>Invite friends</button>{isHost?<button className="primary-button" onClick={()=>void action({type:'start'})}>Start the flood <ArrowRight size={18}/></button>:<span className="waiting-label">Waiting for the captain to start…</span>}</div></section>}
      {player?.down&&!ended&&<div className="rescue-banner"><LifeBuoy size={25}/><div><strong>You need a hand!</strong><span>A nearby teammate can press F to pull you out.</span></div></div>}
      {player&&player.breath<6&&!player.down&&!ended&&<div className="breath-warning"><Waves size={18}/><strong>Get above the water!</strong><Progress value={player.breath/8*100} aria-label="Breath remaining"/></div>}
      <div className="play-bottom">{hud.crane?<div className="crane-panel"><Construction size={29}/><div><strong>You have the crane</strong><span>Move with WASD · Q up · Z down · E release</span></div><button onClick={()=>void action({type:'crane-move',x:0,z:0,y:1})} aria-label="Raise crane"><ArrowUp size={19}/></button><button onClick={()=>void action({type:'crane-move',x:0,z:0,y:-1})} aria-label="Lower crane"><ArrowDown size={19}/></button><button className="crane-release" onClick={()=>void action({type:'crane-drop'})}>Release</button></div>:<div className={`interaction-hint ${hud.placementError?'invalid':''}`}><span className="hint-dot"/>{hud.carrying?<><strong>{ITEMS[hud.carrying as Kind].name}</strong><span>{hud.placementError||'Aim at a surface. Place it with E.'}</span></>:hud.target?<><strong>{hud.target}</strong><span>Pick it up. It might be load-bearing.</span></>:<span>Walk to some salvage, then press E to pick it up.</span>}</div>}
        <div className="tool-dock"><button className={hud.carrying?'active':''} onClick={()=>scene.current?.interact()}><Hand size={19}/><span>{hud.carrying?'Place':'Pick up'}</span><kbd>E</kbd></button><button disabled={!hud.carrying&&!hud.crane} onClick={()=>void action({type:'rotate'})}><RotateCw size={18}/><span>Rotate</span><kbd>R</kbd></button><i/><button className={hud.crane?'active':''} onClick={()=>scene.current?.crane()}><Construction size={20}/><span>Crane</span><kbd>C</kbd></button><button onClick={()=>void action({type:'rescue'})}><LifeBuoy size={19}/><span>Rescue</span><kbd>F</kbd></button><i/><button onClick={()=>void action({type:'wave'})}><Flag size={18}/><span>Over here!</span><kbd>G</kbd></button></div><div className="movement-hint"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span><span><kbd>SPACE</kbd> Jump</span><span>Drag to orbit · Scroll to zoom</span></div>
      </div>
      <div className="touch-controls"><div className="joystick" role="group" aria-label="Movement joystick" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);const r=e.currentTarget.getBoundingClientRect();if(scene.current)scene.current.touch={x:(e.clientX-r.left-r.width/2)/35,z:(e.clientY-r.top-r.height/2)/35};}} onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const r=e.currentTarget.getBoundingClientRect();if(scene.current)scene.current.touch={x:(e.clientX-r.left-r.width/2)/35,z:(e.clientY-r.top-r.height/2)/35};}} onPointerUp={e=>{if(scene.current)scene.current.touch={x:0,z:0};e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{if(scene.current)scene.current.touch={x:0,z:0};}} onLostPointerCapture={()=>{if(scene.current)scene.current.touch={x:0,z:0};}}><span><ArrowUp size={24}/></span></div><button className="touch-jump" onPointerDown={e=>{e.preventDefault();scene.current?.jump();}} aria-label="Jump"><ArrowUp size={26}/><span>JUMP</span></button></div>
    </>}
    {session&&!state&&<div className="connecting-card"><LoaderCircle className="spin"/><strong>Finding your crew…</strong><button className="secondary-button" onClick={()=>void leave()}>Back to the yard</button></div>}
    {status==='expired'&&session&&<div className="connecting-card"><LifeBuoy size={30}/><strong>Your crew pass expired.</strong><p>Return to the menu and rejoin with the room code.</p><button className="primary-button" onClick={()=>void leave()}>Back to menu</button></div>}
    {notice&&<div className="game-notice" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss message"><X size={15}/></button></div>}
    <Dialog open={help} onOpenChange={setHelp}><DialogContent className="game-dialog help-dialog"><span className="dialog-emblem"><LifeBuoy size={27}/></span><DialogTitle>Some assembly required.</DialogTitle><DialogDescription>Build a way to the rescue platform before the flood catches your crew.</DialogDescription><div className="help-steps"><div><Hand/><p><strong>Salvage something.</strong>Walk up to junk and press E. Carry it to your tower, aim, then press E again. R turns it.</p></div><div><Mountain/><p><strong>Build yourself a staircase.</strong>Use low pieces as steps. WASD moves, Space jumps. Removing the bottom makes the top fall.</p></div><div><Construction/><p><strong>Mind the crane.</strong>Click a piece, then press C. WASD moves the load; Q raises it, Z lowers it, E releases it. Only one operator at a time.</p></div><div><LifeBuoy/><p><strong>Leave no hard hat behind.</strong>F rescues nearby fallen teammates. One player reaching the platform saves everyone. If everyone goes under, try again.</p></div></div><p className="help-note">Drag the yard to orbit. Scroll to zoom. V shows the whole yard. On touchscreens, use the joystick and action buttons.</p><button className="primary-button" onClick={()=>setHelp(false)}>Got it. Probably. <Check size={18}/></button></DialogContent></Dialog>
    <Dialog open={join} onOpenChange={setJoin}><DialogContent className="game-dialog"><span className="dialog-emblem"><Users size={27}/></span><DialogTitle>Find your crew.</DialogTitle><DialogDescription>Ask your captain for the six-character room code.</DialogDescription><form onSubmit={e=>{e.preventDefault();void joinCrew();}}><label className="field-label" htmlFor="join-name">Your name</label><input id="join-name" className="dialog-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Salvage apprentice" maxLength={18}/><label className="field-label" htmlFor="join-code">Room code</label><input id="join-code" className="dialog-input code-input" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6))} placeholder="ABC234" maxLength={6} autoComplete="off" spellCheck={false}/><button className="primary-button" disabled={busy||code.length!==6||!ready}>{busy?'Joining…':'Join the crew'}<ArrowRight size={18}/></button></form>{notice&&<p role="alert" className="dialog-error">{notice}</p>}</DialogContent></Dialog>
    <Dialog open={invite} onOpenChange={setInvite}><DialogContent className="game-dialog"><span className="dialog-emblem"><HardHat size={27}/></span><DialogTitle>Bring three bad builders.</DialogTitle><DialogDescription>Share this code or copy an invite link. Friends join before the captain starts the flood.</DialogDescription><div className="invite-code">{session?.code}</div><button className="primary-button" onClick={()=>void copyInvite()}>{copied?'Invite copied!':'Copy invite link'}{copied?<Check size={18}/>:<Copy size={18}/>}</button><p className="help-note">Everyone needs access to this game’s website to join.</p></DialogContent></Dialog>
    <Dialog open={!!ended} onOpenChange={()=>{}}><DialogContent className="game-dialog result-dialog" showCloseButton={false}><span className="dialog-emblem">{world?.phase==='won'?<Trophy size={34}/>:<Anchor size={34}/>}</span><DialogTitle>{world?.phase==='won'?'Against all building codes.':'A magnificent pile of nope.'}</DialogTitle><DialogDescription>{world?.phase==='won'?'You reached the rescue platform. The whole crew made it out!':'The flood caught the whole crew. Same junk. Better plan?'}</DialogDescription><div className="result-stats"><span><strong>{clock(elapsed)}</strong>Time survived</span><span><strong>{world?.bestHeight.toFixed(1)} m</strong>Best stack</span></div>{isHost?<button className="primary-button" onClick={()=>void action({type:'restart'})}>Build it better <RotateCw size={18}/></button>:<p className="help-note">Waiting for your captain to start another round.</p>}<button className="secondary-button" onClick={()=>void leave()}>Back to menu</button></DialogContent></Dialog>
    <Dialog open={exitDialog} onOpenChange={setExitDialog}><DialogContent className="game-dialog"><DialogTitle>Clocking off?</DialogTitle><DialogDescription>{isLocal?'Your practice tower will be cleared when you leave.':'Your teammates can keep building. You can join the crew again between rounds.'}</DialogDescription><button className="primary-button" onClick={()=>void leave()}>Leave the yard <LogOut size={18}/></button><button className="secondary-button" onClick={()=>setExitDialog(false)}>Keep building</button></DialogContent></Dialog>
  </main>;
}
