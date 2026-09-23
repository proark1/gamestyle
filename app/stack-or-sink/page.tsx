import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import Game from '@/games/stack-or-sink/Game';
export const metadata = {
  title: 'Stack or Sink — Jumbleyard',
  description:
    'Build a tower of junk and save your crew from the rising flood. A cooperative game for one to four players.',
};
export default async function Page() {
  return (await gamePageAccess('stack-or-sink')) ? (
    <Game />
  ) : (
    <LockedGame game="stack-or-sink" />
  );
}
