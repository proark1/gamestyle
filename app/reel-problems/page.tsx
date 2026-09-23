import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import ReelProblems from '@/games/reel-problems/Game';
export const metadata = {
  title: 'Reel Problems — Jumbleyard',
  description:
    'Four friends. One tiny boat. The fish caught us. Cast, reel, untangle, and rescue your crew in a five-minute fishing tournament.',
};
export default async function Page() {
  return (await gamePageAccess('reel-problems')) ? (
    <ReelProblems />
  ) : (
    <LockedGame game="reel-problems" />
  );
}
