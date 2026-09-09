import type { AudioCategory } from './types';

export const SOUND_PROMPT_LIMIT = 450;
export function promptLimit(category: AudioCategory) {
  return category === 'speech' || category === 'music'
    ? 2000
    : SOUND_PROMPT_LIMIT;
}
