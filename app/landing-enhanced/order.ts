export const STANDARD_PINNED = [
  'slopewreck',
  'chain-of-fools',
  'scaffold-scramble',
  'stack-or-sink',
  'uphill-delivery',
  'reel-problems',
  'reel-problems-2',
  'reel-problems-3',
  'reel-problems-4',
  'shelf-control',
] as const;

export const STANDARD_SHUFFLED = [
  'course-correction',
  'bouncy-castle-royale',
  'cage-clash',
  'on-the-ropes',
  'drive-thru',
  'sample-stampede',
  'carry-on-carnage',
  'bungee-doubles',
  'basketball',
  'crane-clash',
  'siege-and-desist',
  'load-bearing',
  'wrong-floor',
  'one-more-button',
  'four-brain-cells',
  'act-natural',
  'dont-wake-the-giant',
  'chaos',
  'first-person',
  'panic-curling',
  'zorb-clash',
] as const;

export const STANDARD_GAME_SLUGS = [
  ...STANDARD_PINNED,
  ...STANDARD_SHUFFLED,
] as const;

export function createEnhancedCollectionOrder(random = Math.random) {
  const shuffled = [...STANDARD_SHUFFLED];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return [...STANDARD_PINNED, ...shuffled];
}
