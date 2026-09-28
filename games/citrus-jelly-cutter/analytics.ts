import type { GameAnalytics } from '../../shared/analytics/protocol';

export const citrusJellyAnalytics: GameAnalytics = {
  game: 'citrus-jelly-cutter',
  milestones: [
    { key: 'first-grab', label: 'Stretched the jelly' },
    { key: 'first-cut', label: 'Completed a knife cut' },
    { key: 'first-stamp', label: 'Stamped a shape' },
    { key: 'first-lift', label: 'Lifted a stamped piece' },
  ],
  actions: {
    hand: 'Selected the hand',
    knife: 'Selected the knife',
    cutter: 'Selected a cutter',
    nudge: 'Nudged the specimen',
    reset: 'Reset the specimen',
    pause: 'Paused the study',
    variety: 'Changed citrus variety',
  },
  labels: { playing: 'Began the study' },
};
