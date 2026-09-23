import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import ZorbClash from '@/games/zorb-clash/Game';

export const metadata = {
  title: 'Zorb Clash — Jumbleyard',
  description:
    'Fast-paced bubble soccer and sumo derby! Strap inside giant transparent bumper balls with hyper-bouncy Cannon physics. Launch your friends across the pitch, avoid the upside-down turtle state, and bounce to victory.',
};

export default async function Page() {
  return (await gamePageAccess('zorb-clash')) ? (
    <ZorbClash />
  ) : (
    <LockedGame game="zorb-clash" />
  );
}
