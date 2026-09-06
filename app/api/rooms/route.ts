import { roomStore } from '@/db/rooms';
import { handleRoom, RoomError } from '@/game/rooms';
import { isRoomOriginAllowed } from '@/game/request-origin';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
  try{
    if(!isRoomOriginAllowed(request,process.env.PUBLIC_GAME_ORIGIN))return json({error:'Open the game to use its room controls.'},403);
    if(Number(request.headers.get('content-length'))>4096)return json({error:'Request too large.'},413);
    const raw=await request.text();if(raw.length>4096)return json({error:'Request too large.'},413);
    let body:Record<string,unknown>;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Invalid request.'},400);
    return json(await handleRoom(roomStore(),body));
  }catch(error){if(error instanceof RoomError)return json({error:error.message},error.status);console.error('Room request failed',error);return json({error:'The crew cabin is unavailable. Try again in a moment, or play a practice run.'},503);}
}
