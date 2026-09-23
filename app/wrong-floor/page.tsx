import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import WrongFloor from '@/games/wrong-floor/Game';
export const metadata = {
  title: 'Wrong Floor — Jumbleyard',
  description:
    'Four friends. Five elevator stops. Only you can see it. Compare private clues, vote together, and escape a hotel that wants you to stay.',
};
export default async function Page() {
  return (await gamePageAccess('wrong-floor')) ? (
    <WrongFloor />
  ) : (
    <LockedGame game="wrong-floor" />
  );
}
