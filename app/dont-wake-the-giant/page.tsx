import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import GiantGame from '@/games/dont-wake-the-giant/Game';
export const metadata = {
  title: 'Tiptoe Thieves — Jumbleyard',
  description:
    'Four tiny thieves. One enormous nap. Sneak, climb a breathing giant, steal treasure and escape together in this 2–4 player cottage heist, with solo practice.',
};
export default async function Page() {
  return (await gamePageAccess('dont-wake-the-giant')) ? (
    <GiantGame />
  ) : (
    <LockedGame game="dont-wake-the-giant" />
  );
}
