import FourBrainCells from '@/games/four-brain-cells/Game';
export const metadata = {
  title: 'Four Brain Cells — Jumbleyard',
  description:
    'Four players. One functioning adult. Control one limb of a clumsy robot, cook pancakes, pour coffee, and try to serve breakfast together.',
};
export default function Page() {
  return <FourBrainCells />;
}
