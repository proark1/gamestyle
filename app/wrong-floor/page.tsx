import WrongFloor from '@/games/wrong-floor/Game';
export const metadata = {
  title: 'Wrong Floor — Jumbleyard',
  description:
    'Four friends. Five elevator stops. Only you can see it. Compare private clues, vote together, and escape a hotel that wants you to stay.',
};
export default function Page() {
  return <WrongFloor />;
}
