// Keep the construction API compatible while using shared room authorization,
// provider names, token grants and participant cleanup.
import {
  voiceToken as sharedVoiceToken,
  leaveVoice as sharedLeaveVoice,
} from '../../../shared/voice/server';
export { sweepVoice } from '../../../shared/voice/server';
export function voiceToken(body: { code: string; id: string; token: string }) {
  return sharedVoiceToken({ ...body, game: 'chaos' });
}
export function leaveVoice(code: string, id: string) {
  return sharedLeaveVoice('chaos', code, id);
}
