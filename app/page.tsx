import { redirect } from 'next/navigation';
import CollectionClient from './CollectionClient';

const PINNED = [
  'chain-of-fools',
  'scaffold-scramble',
  'stack-or-sink',
  'uphill-delivery',
  'reel-problems',
  'reel-problems-2',
  'shelf-control',
] as const;

const SHUFFLED = [
  'flip-happens',
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

function shuffle(slugs: readonly string[]) {
  const order = [...slugs];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; raum?: string }>;
}) {
  const { room, raum } = await searchParams;
  if (room && /^[A-Z2-9]{6}$/i.test(room))
    redirect(`/stack-or-sink?room=${encodeURIComponent(room)}`);
  if (raum && /^[A-Z2-9]{6}$/i.test(raum))
    redirect(`/chaos?raum=${encodeURIComponent(raum)}`);
  const order = [...PINNED, ...shuffle(SHUFFLED)];
  return <CollectionClient order={order} />;
}
