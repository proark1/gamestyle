import dynamic from 'next/dynamic';

const Lookdev = dynamic(
  () => import('@/games/reel-problems-3/lookdev/Lookdev'),
);

export const metadata = {
  title: 'Reel Problems 3 Lookdev — Jumbleyard',
  description:
    'A live, playable comparison of three visual directions for Reel Problems 3.',
};

export default function Page() {
  return <Lookdev />;
}
