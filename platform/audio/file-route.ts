import { isGameId } from '@/shared/audio/types';
import { getAudio } from '@/shared/audio/storage';

export async function GET(
  _request: Request,
  context: { params: Promise<{ game: string; file: string }> },
) {
  const { game, file } = await context.params;
  if (!isGameId(game) || !/^[a-f0-9-]{36}\.mp3$/.test(file))
    return new Response(null, { status: 404 });
  try {
    // Serve only generated audio paths; never accept arbitrary filesystem paths.
    const bytes = await getAudio(`${game}/${file}`);
    if (!bytes) return new Response(null, { status: 404 });
    return new Response(bytes, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
