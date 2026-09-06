import { roomStore } from '@/db/rooms';
export async function GET() {
  try {
    await roomStore().get('__health__');
    return Response.json({ status: 'ok', game: 'stack-or-sink' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
