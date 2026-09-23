import Game from '@/games/chaos/Game';
import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import '@/games/chaos/game.css';
import '@/games/chaos/start-screen.css';
export const metadata = { title: 'Permit Pending — Jumbleyard' };
export default async function ChaosPage() {
  return (await gamePageAccess('chaos')) ? (
    <Game />
  ) : (
    <LockedGame game="chaos" />
  );
}
