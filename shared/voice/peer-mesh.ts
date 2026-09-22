import { apiFetch } from '../browser/api-fetch';
import { PeerMesh } from '../peer/mesh';
import { PeerError, type PeerReply } from '../peer/types';
import type { VoiceSession } from './types';

export function serverRoomVoiceMesh(session: VoiceSession) {
  const mesh = new PeerMesh(session, async (body) => {
    const response = await apiFetch('/api/voice/peer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    const reply = (await response.json()) as PeerReply & { error?: string };
    if (!response.ok)
      throw new PeerError(
        reply.error ?? 'Voice connection interrupted.',
        response.status,
      );
    return reply;
  });
  return {
    mesh,
    release: () => {
      void mesh.leave().catch(() => {});
    },
  };
}
