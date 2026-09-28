import type { Metadata } from 'next';
import CitrusJellyGame from '../../games/citrus-jelly-cutter/Game';

export const metadata: Metadata = {
  title: 'Citrus Jelly — Jumbleyard',
  description:
    'Stretch, slice, stamp, and lift shapes from a translucent gummy orange.',
};

export default function CitrusJellyPage() {
  return <CitrusJellyGame />;
}
