import ScaffoldScrambleGame from '@/games/scaffold-scramble/Game';

export const metadata = {
  title: 'Scaffold Scramble — Jumbleyard',
  description:
    'Two manual winches, eighty stories in the air, and squeegees sliding down a 45-degree slope. Wash 30 dirty windows before the CEO’s helicopter lands on the roof!',
};

export default function Page() {
  return <ScaffoldScrambleGame />;
}
