import type { Metadata } from 'next';
import '../landing-concepts/landing-shared.css';
import './landing3.css';
import ArcadeLanding from './ArcadeLanding';

export const metadata: Metadata = {
  title: 'Arcade Cabinet — Jumbleyard',
  description:
    'Insert friends. Choose from a neon aisle of quick Jumbleyard browser party games.',
};

export default function LandingThreePage() {
  return <ArcadeLanding />;
}
