import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import SiegeAndDesist from '@/games/siege-and-desist/Game';
export const metadata = {
  title: 'Siege and Desist — Jumbleyard',
  description:
    'One trebuchet. Four opinions. Wind the counterweight, load the sling, and bring down the keep’s banner before dawn. A medieval co-op siege for one to four players.',
};
export default async function Page() {
  return (await gamePageAccess('siege-and-desist')) ? (
    <SiegeAndDesist />
  ) : (
    <LockedGame game="siege-and-desist" />
  );
}
