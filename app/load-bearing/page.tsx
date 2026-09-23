import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import LoadBearing from '@/games/load-bearing/Game';
export const metadata = {
  title: 'Load Bearing — Jumbleyard',
  description:
    'Three minutes to bring a condemned house down without destroying the piano on the upper floor. One to four wreckers, sledgehammers and a shared wrecking ball.',
};
export default async function Page() {
  return (await gamePageAccess('load-bearing')) ? (
    <LoadBearing />
  ) : (
    <LockedGame game="load-bearing" />
  );
}
