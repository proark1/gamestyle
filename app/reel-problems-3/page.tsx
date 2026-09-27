import dynamic from 'next/dynamic';

const ReelProblems3 = dynamic(() => import('@/games/reel-problems-3/Game'));

export const metadata = {
  title: 'Reel Problems 3 — Jumbleyard',
  description:
    'A first-person cooperative voyage through a handcrafted archipelago. Awaken the beacons, survive the storm, and guide a legendary fish home.',
};

export default function Page() {
  return <ReelProblems3 />;
}
