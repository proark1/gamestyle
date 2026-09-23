import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import SampleStampedeGame from '@/games/sample-stampede/Game';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export const metadata = {
  title: 'Sample Stampede — Jumbleyard',
  description:
    'The chaotic experience of wholesale warehouse shopping! Push squeaky-wheel drifting carts, race for free taquito samples, and avoid contraband teddy bears at the receipt gauntlet.',
};

export default async function Page() {
  return (await gamePageAccess('sample-stampede')) ? (
    <SampleStampedeGame />
  ) : (
    <LockedGame game="sample-stampede" />
  );
}
