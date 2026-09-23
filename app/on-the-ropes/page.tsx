import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import BoxingGame from '@/games/on-the-ropes/Game';
export default async function Page() {
  return (await gamePageAccess('on-the-ropes')) ? (
    <BoxingGame />
  ) : (
    <LockedGame game="on-the-ropes" />
  );
}
