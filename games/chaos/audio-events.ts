import type { GameEvent } from './model';
import { SAYINGS as CHAOS_SAYINGS } from './catalog';
export function chaosCue(event: GameEvent): string | null {
  if (event.audioCue) return event.audioCue;
  if (event.type === 'emote') {
    const i = CHAOS_SAYINGS.indexOf(event.speech || '');
    return i >= 0 ? `speech.saying.${i}` : null;
  }
  if (['bonk', 'wind', 'join'].includes(event.type))
    return `event.${event.type}`;
  return null;
}
