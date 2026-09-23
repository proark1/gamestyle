import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import UphillDelivery from '@/games/uphill-delivery/Game';
export const metadata = {
  title: 'Uphill Delivery — Jumbleyard',
  description:
    'Four friends. One sofa. No elevator. Carry, climb, and catch your cargo through a mountain village in this 1–4 player physics game.',
};
export default async function Page() {
  return (await gamePageAccess('uphill-delivery')) ? (
    <UphillDelivery />
  ) : (
    <LockedGame game="uphill-delivery" />
  );
}
