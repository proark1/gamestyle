import Game from '@/games/first-person/Game';
import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
export const metadata = { title: 'Brick by Hand — Jumbleyard' };
export default async function FirstPersonPage() {
  return (await gamePageAccess('first-person')) ? (
    <Game />
  ) : (
    <LockedGame game="first-person" />
  );
}
