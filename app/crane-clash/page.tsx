import CraneClash from '@/games/crane-clash/Game';

export const metadata = {
  title: 'Crane Clash — Jumbleyard',
  description:
    'Two cranes. Four players. Baustellen-Chaos! Swing from the crane cable, grab crates, and build the highest tower before time runs out. A competitive 2v2 physics party game for 1–4 players.',
};

export default function Page() {
  return <CraneClash />;
}
