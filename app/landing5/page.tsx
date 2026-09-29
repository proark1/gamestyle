import type { Metadata } from 'next';
import CollectionClient from '../CollectionClient';
import EnhancedStandardShell from '../landing-enhanced/EnhancedStandardShell';
import { createEnhancedCollectionOrder } from '../landing-enhanced/order';
import '../landing-enhanced/enhanced-standard.css';
import './landing5.css';

export const metadata: Metadata = {
  title: 'Clubhouse Trailer — Jumbleyard',
  description:
    'Arrive at the Jumbleyard clubhouse, pick a game, and bring your crew into the chaos.',
};

export default function ClubhouseTrailerPage() {
  return (
    <EnhancedStandardShell
      variant="trailer"
      poster="/videos/landing-enhanced/clubhouse-trailer-poster.webp"
      src="/videos/landing-enhanced/clubhouse-trailer.mp4"
    >
      <CollectionClient order={createEnhancedCollectionOrder()} />
    </EnhancedStandardShell>
  );
}
