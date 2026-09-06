import type { Action, Input, Session, Snapshot } from './types';
type Reply={session?:Session;snapshot?:Snapshot;error?:string;ok?:boolean};
export class NetworkError extends Error{constructor(message:string,public status:number){super(message);}}
export async function requestRoom(body:object):Promise<Reply>{
  const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  let data:Reply;try{data=await response.json();}catch{throw new NetworkError('The connection was interrupted. Try again.',response.status);}
  if(!response.ok)throw new NetworkError(data.error||'Could not reach your crew.',response.status);return data;
}
export class Connection {
  stopped=false;timer:ReturnType<typeof setTimeout>|undefined;input:Input={x:0,z:0,jump:false,seq:0};version=-1;queue:Promise<unknown>=Promise.resolve();failures=0;
  constructor(public session:Session,public onState:(s:Snapshot)=>void,public onStatus:(status:'online'|'reconnecting'|'expired')=>void){}
  accept(s?:Snapshot){if(s&&s.version>=this.version){this.version=s.version;this.onState(s);}}
  start(){void this.poll();}
  private async poll(){
    if(this.stopped)return;
    try{const reply=await requestRoom({op:'sync',...this.session,input:this.input});if(this.stopped)return;this.accept(reply.snapshot);this.failures=0;this.onStatus('online');}
    catch(e){if(this.stopped)return;this.failures++;if(e instanceof NetworkError&&(e.status===401||e.status===404)){this.onStatus('expired');this.stop();return;}this.onStatus('reconnecting');}
    if(!this.stopped)this.timer=setTimeout(()=>void this.poll(),this.failures?Math.min(3000,this.failures*500):100);
  }
  async action(action:Action){
    const requestId=crypto.randomUUID();
    const task=this.queue.catch(()=>{}).then(async()=>{if(this.stopped)throw new Error('Reconnect to the crew before playing.');const reply=await requestRoom({op:'action',...this.session,input:this.input,action,requestId});if(!this.stopped)this.accept(reply.snapshot);});
    this.queue=task;return task;
  }
  stop(){this.stopped=true;if(this.timer)clearTimeout(this.timer);}
  async leave(){this.stop();await requestRoom({op:'leave',...this.session}).catch(()=>{});}
}
