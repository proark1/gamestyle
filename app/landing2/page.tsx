import type { Metadata } from 'next';
import '../landing-concepts/landing-shared.css';
import './landing2.css';
import BroadcastLanding from './BroadcastLanding';

export const metadata: Metadata = {
  title: 'Party Broadcast — Jumbleyard',
  description:
    'Tonight on Jumbleyard: quick browser party games, loud friends, and absolutely no plan.',
};

export default function LandingTwoPage() {
  return <BroadcastLanding />;
}
