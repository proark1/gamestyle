import { SOUND_PROMPT_LIMIT } from '../limits';
export const recording =
  'Close natural location recording at arm length outdoors; believable weight, unprocessed texture and brief natural decay. Only the described action. No speech, music, cartoon effects, cinematic bass, electronic tones or added background machinery.';

export function materialPrompt(sound: string) {
  const full = `${sound} ${recording}`;
  if (full.length <= SOUND_PROMPT_LIMIT) return full;
  // Preserve the entire physical sequence; shorten only repeated recording direction.
  const compact = `${sound} Natural close outdoor Foley. No speech, music or synthetic effects.`;
  if (compact.length > SOUND_PROMPT_LIMIT)
    throw new Error(
      'Material prompt exceeds the ElevenLabs sound-effects limit.',
    );
  return compact;
}
