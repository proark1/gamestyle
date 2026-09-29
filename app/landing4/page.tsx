import type { Metadata } from 'next';
import CollectionClient from '../CollectionClient';
import EnhancedStandardShell from '../landing-enhanced/EnhancedStandardShell';
import { createEnhancedCollectionOrder } from '../landing-enhanced/order';
import '../landing-enhanced/enhanced-standard.css';
import './landing4.css';

export const metadata: Metadata = {
  title: 'Living Clubhouse — Jumbleyard',
  description:
    'Step into the living Jumbleyard clubhouse, pick a game, and bring your crew into the chaos.',
};

export default function LivingClubhousePage() {
  return (
    <EnhancedStandardShell
      variant="living"
      poster="/videos/landing-enhanced/living-clubhouse-poster.webp"
      src="/videos/landing-enhanced/living-clubhouse.mp4"
    >
      <CollectionClient order={createEnhancedCollectionOrder()} />
    </EnhancedStandardShell>
  );
}
