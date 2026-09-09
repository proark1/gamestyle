import { clamp, type GameEvent, type Kind } from './types';

export type Cue = 'good' | 'danger' | 'info';
export type Material = 'wood' | 'soft' | 'porcelain' | 'metal' | 'ground';
export type Click = 'tap' | 'confirm' | 'deny' | 'tick';
export type Bark = 'here' | 'help' | 'got';

const MATERIALS:Record<Kind,Material>={crate:'wood',pallet:'wood',plank:'wood',sofa:'soft',bathtub:'porcelain',fridge:'metal'};
export const materialOf=(kind:Kind):Material=>MATERIALS[kind];

type Colour={type:BiquadFilterType;frequency:number;q:number};
type Struck={partials:number[];decay:number;noise:Colour&{decay:number;gain:number};gain:number};
/** Partial sets are the ring of the struck body; the noise layer is the strike itself. */
const IMPACTS:Record<Material,Struck>={
  wood:      {partials:[196,311,459],      decay:.17,noise:{type:'bandpass',frequency:1100,q:1.1,decay:.045,gain:.9}, gain:1},
  soft:      {partials:[88,132],           decay:.11,noise:{type:'lowpass', frequency:420, q:.7, decay:.075,gain:.7}, gain:.6},
  porcelain: {partials:[642,1187,1791],    decay:.52,noise:{type:'bandpass',frequency:2700,q:2.2,decay:.03, gain:.75},gain:.85},
  metal:     {partials:[227,431,709,1103], decay:.78,noise:{type:'bandpass',frequency:3200,q:1.8,decay:.04, gain:.6}, gain:.8},
  ground:    {partials:[104,158],          decay:.13,noise:{type:'lowpass', frequency:760, q:.8, decay:.06, gain:1},  gain:.9},
};
const STEPS:Record<Material,Colour&{gain:number;thump:number}>={
  wood:      {type:'bandpass',frequency:1500,q:1.4,gain:.5, thump:190},
  soft:      {type:'lowpass', frequency:520, q:.8,gain:.3, thump:0},
  porcelain: {type:'bandpass',frequency:3000,q:2.4,gain:.4, thump:0},
  metal:     {type:'bandpass',frequency:2500,q:1.9,gain:.45,thump:120},
  ground:    {type:'lowpass', frequency:950, q:.9,gain:.42,thump:0},
};
const CUES:Record<Cue,number[]>={good:[392,494,587],danger:[220,165],info:[330,392]};
// D dorian. The pad glides between these rather than restriking, so the bed never punctuates the round.
const CHORDS=[[38,50,53,57,62],[34,46,50,53,58],[41,48,53,57,60],[33,45,48,52,57]];
const ARPS=[[62,65,69,72],[58,62,65,70],[60,65,69,72],[57,60,64,69]];
const midi=(n:number)=>440*2**((n-69)/12);
const MAX_VOICES=20, CHORD_SECONDS=7.5;
// Recorded crew barks, one set per hard hat. 'here' alternates so the wave does not wear out.
const BARKS:Record<Bark,string[]>={here:['here','here2'],help:['help'],got:['got']};
const HATS=4;

/** Everything the game can ask for. Implemented by Audio; stubbed in tests. */
export type AudioSink={
  impact(material:Material,energy:number,x:number,y:number,z:number):void;
  creak(intensity:number,x:number,y:number,z:number):void;
  footstep(material:Material,energy:number,x:number,y:number,z:number):void;
  splash(size:number,x:number,y:number,z:number):void;
  clank(x:number,y:number,z:number):void;
  heft(material:Material,heavy:number,x:number,y:number,z:number):void;
  gasp():void;
  heartbeat(strength:number):void;
  klaxon():void;
  sting(win:boolean):void;
  call(x:number,y:number,z:number):void;
  bark(kind:Bark,colour:number,x:number,y:number,z:number):void;
  cue(kind:Cue):void;
  event(e:GameEvent,localId:string,colour?:number):void;
  click(kind:Click):void;
  setListener(x:number,y:number,z:number,yaw:number):void;
  setAmbience(level:number):void;
  setSubmersion(level:number):void;
  setCrane(active:boolean,x:number,y:number,z:number):void;
  setIntensity(level:number):void;
  update():void;
};

export class Audio implements AudioSink {
  context:AudioContext|null=null;
  enabled=true;musicEnabled=true;volume=.7;
  private limiter?:DynamicsCompressorNode;
  private master?:GainNode;
  private submerge?:BiquadFilterNode;
  private bus?:Record<'sfx'|'ambience'|'music'|'ui',GainNode>;
  private noise?:AudioBuffer;
  private sea?:GainNode;
  private hum?:{gain:GainNode;pan:StereoPannerNode};
  private pad?:{voices:{osc:OscillatorNode;detune:OscillatorNode}[];filter:BiquadFilterNode;gain:GainNode};
  private barks=new Map<string,AudioBuffer>();private barksRequested=false;
  private chord=0;private chordAt=0;private arpAt=0;private arpStep=0;private intensity=0;
  private listener={x:0,y:0,z:0,yaw:0};
  private active:number[]=[];
  private suspendTimer:ReturnType<typeof setTimeout>|undefined;
  private ducked=false;

  async unlock(){
    if(!this.context){this.context=new AudioContext();this.build();}
    clearTimeout(this.suspendTimer);
    if(this.context.state==='suspended')await this.context.resume();
  }
  private build(){
    const ctx=this.context!;
    this.limiter=ctx.createDynamicsCompressor();
    this.limiter.threshold.value=-11;this.limiter.knee.value=6;this.limiter.ratio.value=14;
    this.limiter.attack.value=.004;this.limiter.release.value=.18;
    this.master=ctx.createGain();this.master.gain.value=this.enabled?this.volume:0;
    // Everything in the yard is heard through the water; the interface is not.
    this.submerge=ctx.createBiquadFilter();this.submerge.type='lowpass';this.submerge.frequency.value=20000;this.submerge.Q.value=.4;
    this.bus={sfx:ctx.createGain(),ambience:ctx.createGain(),music:ctx.createGain(),ui:ctx.createGain()};
    this.bus.ambience.gain.value=0;this.bus.music.gain.value=this.musicEnabled?.5:0;this.bus.ui.gain.value=.85;
    for(const key of ['sfx','ambience','music'] as const)this.bus[key].connect(this.submerge);
    this.submerge.connect(this.master);this.bus.ui.connect(this.master);
    this.master.connect(this.limiter);this.limiter.connect(ctx.destination);
    const frames=Math.floor(ctx.sampleRate*2);
    this.noise=ctx.createBuffer(1,frames,ctx.sampleRate);
    const data=this.noise.getChannelData(0);
    for(let i=0;i<frames;i++)data[i]=Math.random()*2-1;
    this.startSea();this.startHum();this.startPad();
    this.chordAt=ctx.currentTime;this.arpAt=ctx.currentTime;
    void this.loadBarks();
  }
  private ready(){return this.enabled&&!!this.bus&&this.context?.state==='running';}
  private at(){return this.context!.currentTime;}
  /** Drops the quietest thing on the floor rather than letting a collapse spawn thirty oscillators. */
  private budget(duration:number){
    const now=this.at();this.active=this.active.filter(end=>end>now);
    if(this.active.length>=MAX_VOICES)return false;
    this.active.push(now+duration);return true;
  }
  private out(bus:GainNode,x?:number,y?:number,z?:number){
    if(x===undefined||z===undefined)return bus;
    const ctx=this.context!,dx=x-this.listener.x,dy=(y??0)-this.listener.y,dz=z-this.listener.z;
    const gain=ctx.createGain();gain.gain.value=1/(1+(Math.hypot(dx,dy,dz)/7)**1.7);
    const pan=ctx.createStereoPanner();
    // Screen-right in the orbiting camera's basis, matching GameScene.input().
    pan.pan.value=clamp((dx*Math.cos(this.listener.yaw)-dz*Math.sin(this.listener.yaw))/11,-1,1);
    gain.connect(pan);pan.connect(bus);return gain;
  }
  private tone(to:AudioNode,at:number,frequency:number,duration:number,peak:number,type:OscillatorType='sine',bend=1){
    const ctx=this.context!,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(frequency,at);
    if(bend!==1)osc.frequency.exponentialRampToValueAtTime(Math.max(20,frequency*bend),at+duration);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(peak,at+Math.min(.008,duration/3));
    gain.gain.exponentialRampToValueAtTime(.0008,at+duration);
    osc.connect(gain);gain.connect(to);osc.start(at);osc.stop(at+duration+.02);
  }
  private burst(to:AudioNode,at:number,duration:number,peak:number,colour:Colour,sweep?:number){
    const ctx=this.context!,src=ctx.createBufferSource();src.buffer=this.noise!;src.loop=true;
    const filter=ctx.createBiquadFilter();filter.type=colour.type;filter.Q.value=colour.q;
    filter.frequency.setValueAtTime(colour.frequency,at);
    if(sweep!==undefined)filter.frequency.exponentialRampToValueAtTime(Math.max(40,sweep),at+duration);
    const gain=ctx.createGain();gain.gain.setValueAtTime(0,at);
    gain.gain.linearRampToValueAtTime(peak,at+Math.min(.005,duration/3));
    gain.gain.exponentialRampToValueAtTime(.0008,at+duration);
    src.connect(filter);filter.connect(gain);gain.connect(to);
    src.start(at,Math.random()*1.5);src.stop(at+duration+.02);
  }

  impact(material:Material,energy:number,x:number,y:number,z:number){
    if(!this.ready())return;
    const e=clamp(energy,0,1),spec=IMPACTS[material],at=this.at(),duration=spec.decay*(.7+e*.5);
    if(!this.budget(duration))return;
    const to=this.out(this.bus!.sfx,x,y,z),peak=(.04+e*.42)*spec.gain,bright=1+e*.09;
    spec.partials.forEach((frequency,i)=>this.tone(to,at,frequency*bright*(1+(Math.random()-.5)*.03),duration/(1+i*.55),peak/(1+i*1.3),i?'sine':'triangle',.87));
    this.burst(to,at,spec.noise.decay*(.8+e*.6),peak*spec.noise.gain,spec.noise);
  }
  creak(intensity:number,x:number,y:number,z:number){
    if(!this.ready())return;
    const at=this.at(),duration=.5+Math.random()*.55;
    if(!this.budget(duration))return;
    const ctx=this.context!,to=this.out(this.bus!.sfx,x,y,z),base=58+Math.random()*34;
    const osc=ctx.createOscillator();osc.type='sawtooth';
    osc.frequency.setValueAtTime(base,at);osc.frequency.linearRampToValueAtTime(base*(1.1+intensity*.5),at+duration);
    const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=430+Math.random()*380;filter.Q.value=5.5;
    const gain=ctx.createGain();gain.gain.setValueAtTime(0,at);
    // Stick-slip: loaded timber does not creak smoothly.
    const peak=.05+clamp(intensity,0,1)*.09;
    for(let t=.02;t<duration;t+=.045+Math.random()*.05)gain.gain.linearRampToValueAtTime(peak*(.15+Math.random()*.85),at+t);
    gain.gain.linearRampToValueAtTime(0,at+duration);
    osc.connect(filter);filter.connect(gain);gain.connect(to);osc.start(at);osc.stop(at+duration+.02);
  }
  footstep(material:Material,energy:number,x:number,y:number,z:number){
    if(!this.ready()||!this.budget(.14))return;
    const at=this.at(),spec=STEPS[material],to=this.out(this.bus!.sfx,x,y,z),peak=spec.gain*(.3+clamp(energy,0,1)*.45)*.42;
    this.burst(to,at,.055+Math.random()*.03,peak,{type:spec.type,frequency:spec.frequency*(.9+Math.random()*.2),q:spec.q});
    if(spec.thump)this.tone(to,at,spec.thump*(.94+Math.random()*.12),.075,peak*.55,'sine',.7);
  }
  splash(size:number,x:number,y:number,z:number){
    if(!this.ready())return;
    const s=clamp(size,0,1),at=this.at(),duration=.3+s*.55;
    if(!this.budget(duration))return;
    const to=this.out(this.bus!.sfx,x,y,z),peak=.1+s*.3;
    this.burst(to,at,.1+s*.08,peak,{type:'highpass',frequency:900,q:.7},2600);
    this.burst(to,at,duration,peak*.75,{type:'lowpass',frequency:1500,q:.9},260);
    for(let i=0,drops=1+Math.round(s*3);i<drops;i++)this.tone(to,at+.06+Math.random()*duration*.7,700+Math.random()*900,.06,peak*.16,'sine',.45);
  }
  clank(x:number,y:number,z:number){
    if(!this.ready()||!this.budget(.6))return;
    const at=this.at(),to=this.out(this.bus!.sfx,x,y,z);
    for(const [frequency,gain] of [[1870,.09],[2790,.05],[930,.06]] as const)this.tone(to,at,frequency*(.97+Math.random()*.06),.55,gain,'sine');
    this.burst(to,at,.05,.1,{type:'highpass',frequency:2400,q:.8});
  }
  /** Taking hold of salvage: it comes free with a scrape, then knocks against you. */
  heft(material:Material,heavy:number,x:number,y:number,z:number){
    if(!this.ready()||!this.budget(.4))return;
    const at=this.at(),to=this.out(this.bus!.sfx,x,y,z),h=clamp(heavy,0,1);
    this.burst(to,at,.16+h*.14,.045+h*.05,{type:'bandpass',frequency:1400-h*600,q:1.2},420);
    this.tone(to,at+.05,120-h*45,.16,.045+h*.06,'sine',.7);
    if(material==='metal'||material==='porcelain')this.tone(to,at+.05,material==='metal'?1103:1187,.3,.02,'sine');
  }
  gasp(){
    if(!this.ready()||!this.budget(.4))return;
    const at=this.at(),to=this.bus!.sfx;
    this.burst(to,at,.36,.15,{type:'bandpass',frequency:520,q:2.6},1500);
    this.burst(to,at+.02,.28,.06,{type:'highpass',frequency:1800,q:.8});
  }
  heartbeat(strength:number){
    if(!this.ready()||!this.budget(.4))return;
    const at=this.at(),to=this.bus!.sfx,peak=.12+clamp(strength,0,1)*.26;
    this.tone(to,at,62,.16,peak,'sine',.55);
    this.tone(to,at+.17,54,.2,peak*.72,'sine',.55);
  }
  klaxon(){
    if(!this.ready())return;
    const ctx=this.context!,at=this.at(),filter=ctx.createBiquadFilter();
    filter.type='lowpass';filter.frequency.value=1300;filter.connect(this.bus!.ui);
    for(let i=0;i<4;i++)this.tone(filter,at+i*.42,i%2?311.13:392,.36,.1,'sawtooth');
  }
  sting(win:boolean){
    if(!this.ready())return;
    const at=this.at(),to=this.bus!.music;
    const notes=win?[293.66,440,587.33,880,1174.66]:[220,174.61,146.83,110];
    notes.forEach((frequency,i)=>{
      const t=at+i*(win?.11:.19);
      this.tone(to,t,frequency,win?1.1:1.4,win?.14:.12,'triangle');
      this.tone(to,t,frequency/2,win?1.1:1.4,win?.06:.08,'sine');
    });
    if(!win)this.tone(to,at,55,2.4,.11,'sine',.92);
  }
  /** The wave mechanic exists to say where you are, so it has to arrive from somewhere. */
  call(x:number,y:number,z:number){
    if(!this.ready()||!this.budget(.5))return;
    const at=this.at(),to=this.out(this.bus!.sfx,x,y,z);
    [880,1174.66].forEach((frequency,i)=>this.tone(to,at+i*.14,frequency,.2,.11,'triangle',1.06));
  }
  /** Fetched once after unlock. A missing or undecodable clip just leaves the synth fallback in place. */
  private async loadBarks(){
    if(this.barksRequested||!this.context)return;
    this.barksRequested=true;
    const names=Object.values(BARKS).flat().flatMap(line=>Array.from({length:HATS},(_,colour)=>`${line}-${colour}`));
    await Promise.all(names.map(async name=>{
      try{
        const response=await fetch(`/audio/barks/${name}.mp3`);
        if(!response.ok)return;
        this.barks.set(name,await this.context!.decodeAudioData(await response.arrayBuffer()));
      }catch{/* stay silent and fall back to the synthesised cue */}
    }));
  }
  bark(kind:Bark,colour:number,x:number,y:number,z:number){
    if(!this.ready())return;
    const lines=BARKS[kind],line=lines[Math.floor(Math.random()*lines.length)];
    const clip=this.barks.get(`${line}-${clamp(Math.round(colour),0,HATS-1)}`);
    if(!clip){if(kind==='here')this.call(x,y,z);else this.cue(kind==='help'?'danger':'good');return;}
    if(!this.budget(clip.duration))return;
    const ctx=this.context!,source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=clip;gain.gain.value=.85;
    source.connect(gain);gain.connect(this.out(this.bus!.sfx,x,y,z));source.start();
  }
  cue(kind:Cue){
    if(!this.ready())return;
    const at=this.at(),to=this.bus!.ui;
    CUES[kind].forEach((frequency,i)=>this.tone(to,at+i*.09,frequency,.2,.06));
  }
  /**
   * The narrative layer only. Placing, cranes, wins and losses are already voiced by the
   * physics observer, so those tags deliberately fall through in silence.
   */
  event(e:GameEvent,localId:string,colour=0){
    const placed=e.x!==undefined&&e.z!==undefined;
    if(e.tag==='wave'&&placed)this.bark('here',colour,e.x!,1.4,e.z!);
    else if(e.tag==='rescue'&&placed)this.bark('got',colour,e.x!,1.4,e.z!);
    else if(e.tag==='down'&&e.actor!==localId&&placed)this.bark('help',colour,e.x!,1.4,e.z!);
    else if(e.tag==='down'&&e.actor!==localId)this.cue('danger');
    else if(e.tag==='start')this.cue('good');
    else if(!e.tag)this.cue(e.kind);
  }
  click(kind:Click){
    if(!this.ready()||!this.budget(.2))return;
    const at=this.at(),to=this.bus!.ui;
    if(kind==='tap')this.tone(to,at,660,.06,.05,'sine',.85);
    else if(kind==='tick')this.tone(to,at,1180,.035,.026,'sine');
    else if(kind==='confirm'){this.tone(to,at,587.33,.09,.055,'sine');this.tone(to,at+.075,880,.14,.045,'sine');}
    else {
      const filter=this.context!.createBiquadFilter();filter.type='lowpass';filter.frequency.value=700;filter.connect(to);
      this.tone(filter,at,180,.13,.07,'square',.72);this.tone(filter,at+.04,120,.14,.05,'square',.75);
    }
  }

  private startSea(){
    const ctx=this.context!,src=ctx.createBufferSource();src.buffer=this.noise!;src.loop=true;
    const surf=ctx.createBiquadFilter();surf.type='lowpass';surf.frequency.value=520;surf.Q.value=.6;
    const wind=ctx.createBiquadFilter();wind.type='bandpass';wind.frequency.value=1750;wind.Q.value=.55;
    const windGain=ctx.createGain();windGain.gain.value=.16;
    const swell=ctx.createOscillator();swell.frequency.value=.07;
    const depth=ctx.createGain();depth.gain.value=190;
    swell.connect(depth);depth.connect(surf.frequency);
    src.connect(surf);surf.connect(this.bus!.ambience);
    src.connect(wind);wind.connect(windGain);windGain.connect(this.bus!.ambience);
    src.start();swell.start();this.sea=this.bus!.ambience;
  }
  private startHum(){
    const ctx=this.context!,gain=ctx.createGain(),pan=ctx.createStereoPanner(),filter=ctx.createBiquadFilter();
    gain.gain.value=0;filter.type='lowpass';filter.frequency.value=240;
    for(const frequency of [58,87.5]){const osc=ctx.createOscillator();osc.type='sawtooth';osc.frequency.value=frequency;osc.connect(filter);osc.start();}
    filter.connect(gain);gain.connect(pan);pan.connect(this.bus!.sfx);
    this.hum={gain,pan};
  }
  private startPad(){
    const ctx=this.context!,filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    filter.type='lowpass';filter.frequency.value=600;filter.Q.value=.7;gain.gain.value=0;
    filter.connect(gain);gain.connect(this.bus!.music);
    const voices=CHORDS[0].map((note,i)=>{
      const osc=ctx.createOscillator(),detune=ctx.createOscillator(),level=ctx.createGain();
      osc.type='triangle';detune.type='sine';detune.detune.value=7;
      osc.frequency.value=midi(note);detune.frequency.value=midi(note);
      level.gain.value=.16/(1+i*.25);
      osc.connect(level);detune.connect(level);level.connect(filter);osc.start();detune.start();
      return {osc,detune};
    });
    this.pad={voices,filter,gain};
  }

  setListener(x:number,y:number,z:number,yaw:number){this.listener={x,y,z,yaw};}
  setAmbience(level:number){if(this.sea)this.sea.gain.setTargetAtTime(clamp(level,0,1)*.55,this.at(),.4);}
  setSubmersion(level:number){if(this.submerge)this.submerge.frequency.setTargetAtTime(20000-clamp(level,0,1)*19560,this.at(),.2);}
  setCrane(active:boolean,x:number,y:number,z:number){
    if(!this.hum)return;
    this.hum.gain.gain.setTargetAtTime(active?.055:0,this.at(),.14);
    const dx=x-this.listener.x,dz=z-this.listener.z;
    this.hum.pan.pan.value=clamp((dx*Math.cos(this.listener.yaw)-dz*Math.sin(this.listener.yaw))/11,-1,1);
  }
  setIntensity(level:number){
    if(!this.pad)return;
    const v=clamp(level,0,1),at=this.at();
    this.pad.gain.gain.setTargetAtTime(v>0?.35+v*.4:0,at,1.4);
    this.pad.filter.frequency.setTargetAtTime(480+v*2100,at,1.8);
    this.intensity=v;
  }
  /** Chord and arpeggio scheduling rides the render loop, so nothing keeps a timer alive. */
  update(){
    if(!this.pad||!this.context||this.context.state!=='running')return;
    const now=this.context.currentTime;
    if(now-this.chordAt>=CHORD_SECONDS){
      this.chordAt=now;this.chord=(this.chord+1)%CHORDS.length;
      CHORDS[this.chord].forEach((note,i)=>{
        const {osc,detune}=this.pad!.voices[i];
        osc.frequency.setTargetAtTime(midi(note),now,1.2);
        detune.frequency.setTargetAtTime(midi(note),now,1.2);
      });
    }
    if(this.intensity<=.3||!this.musicEnabled){this.arpAt=Math.max(this.arpAt,now);return;}
    const beat=.46-this.intensity*.14;
    while(this.arpAt<now+.25){
      const notes=ARPS[this.chord],note=notes[this.arpStep%notes.length];
      this.tone(this.pad.filter,Math.max(this.arpAt,now),midi(note),.5,.045*this.intensity,'triangle');
      this.arpStep++;this.arpAt=Math.max(this.arpAt,now)+beat;
    }
  }

  setVolume(volume:number){this.volume=clamp(volume,0,1);if(this.master&&this.enabled)this.master.gain.setTargetAtTime(this.volume,this.at(),.05);}
  setMusic(on:boolean){this.musicEnabled=on;if(this.bus)this.bus.music.gain.setTargetAtTime(on?.5:0,this.at(),.3);}
  setDucked(ducked:boolean){
    this.ducked=ducked;
    if(this.master&&this.enabled)this.master.gain.setTargetAtTime(this.volume*(ducked?.3:1),this.at(),.12);
  }
  /** Muting releases the audio hardware instead of just skipping cues. */
  setEnabled(enabled:boolean){
    this.enabled=enabled;clearTimeout(this.suspendTimer);
    if(!this.context||!this.master)return;
    if(enabled){void this.context.resume();this.master.gain.setTargetAtTime(this.volume*(this.ducked?.3:1),this.at(),.08);}
    else {this.master.gain.setTargetAtTime(0,this.at(),.05);this.suspendTimer=setTimeout(()=>void this.context?.suspend(),260);}
  }
  dispose(){clearTimeout(this.suspendTimer);void this.context?.close();this.context=null;this.bus=undefined;}
}
