import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import ReelProblems from '@/games/reel-problems-2/Game';
export const metadata = {
  title: 'Reel Problems 2 — Jumbleyard',
  description:
    'Hook a giant, row through a storm, rescue your friends, and build a raft when your boat breaks. Get everyone home in this cooperative survival adventure.',
};
export default async function Page() {
  return (await gamePageAccess('reel-problems-2')) ? (
    <ReelProblems />
  ) : (
    <LockedGame game="reel-problems-2" />
  );
}
