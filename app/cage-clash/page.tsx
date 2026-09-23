import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import CageGame from '@/games/cage-clash/Game';
export default async function Page() {
  return (await gamePageAccess('cage-clash')) ? (
    <CageGame />
  ) : (
    <LockedGame game="cage-clash" />
  );
}
