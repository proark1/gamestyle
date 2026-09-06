export class Sound {
  context:AudioContext|null=null;enabled=true;
  async unlock(){if(!this.context)this.context=new AudioContext();if(this.context.state==='suspended')await this.context.resume();}
  cue(kind:'good'|'danger'|'info'){
    if(!this.enabled||!this.context||this.context.state!=='running')return;
    const notes=kind==='good'?[392,494,587]:kind==='danger'?[220,165]:[330,392];
    notes.forEach((frequency,i)=>{const osc=this.context!.createOscillator(),gain=this.context!.createGain(),t=this.context!.currentTime+i*.09;osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.065,t+.012);gain.gain.exponentialRampToValueAtTime(.001,t+.2);osc.connect(gain);gain.connect(this.context!.destination);osc.start(t);osc.stop(t+.21);});
  }
  dispose(){void this.context?.close();}
}
