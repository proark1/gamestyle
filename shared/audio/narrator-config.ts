import type { GameId } from './types';

export const NARRATOR_DEFAULTS = {
  name: 'The Chaos Commentator',
  description:
    'An original male English-speaking narrator in his thirties with a light British accent. Warm mid-low register, a little gravel and a smile in the voice. A charismatic multiplayer game-show host watching his friends make spectacularly bad decisions. Effortlessly cool, mischievous and quick-witted. Dry deadpan setups, perfectly timed pauses, playful disbelief, then brief bursts of delighted excitement when everything goes wrong. Teasing is affectionate, never cruel. Conversational and human, with crisp diction and short punchy phrases that cut through busy gameplay. Expressive pitch and natural rhythm; relaxed confidence between the big reactions. Clean close-mic studio sound.',
  text: 'Welcome, you magnificent disasters. Four friends. One plan. Absolutely no evidence that it will work. Oh, lovely. You have put a house on a barrel. A bold architectural statement. And over here, someone is pretending to be a perfectly normal farmer. The chicken disagrees. Steady... steady... spectacular. I give that landing a ten. The insurance company gives it a lawsuit.',
};
export type NarratorConfig = typeof NARRATOR_DEFAULTS;
export type NarratorPreview = { id: string; url: string; voiceId?: string };
export type NarratorState = {
  config: NarratorConfig;
  audition: {
    config: NarratorConfig;
    sourceGame: GameId;
    previews: NarratorPreview[];
  } | null;
  voice: {
    id: string;
    name: string;
    sourceGame: GameId;
  } | null;
  sample: { text: string; url: string; voiceId: string } | null;
  busy: boolean;
};
