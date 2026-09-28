import type { Metadata } from 'next';
import '../landing-concepts/landing-shared.css';
import './landing1.css';
import CinematicLanding from './CinematicLanding';

export const metadata: Metadata = {
  title: 'Cinematic Toybox — Jumbleyard',
  description:
    'Step into a cinematic toybox of quick browser party games. Bring your friends and make a little chaos.',
};

export default function LandingOnePage() {
  return <CinematicLanding />;
}
