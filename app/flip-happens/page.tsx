import FlipGame from '../../games/flip-happens/Game';
import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
export const metadata = {
  title: 'Flip Happens — Jumbleyard',
  description:
    'One table. Six ridiculous objects. Flip, land and bank your combo before a washing machine ruins everything. Play with up to four friends or try the daily challenge.',
};
export default async function Page() {
  return (await gamePageAccess('flip-happens')) ? (
    <FlipGame />
  ) : (
    <LockedGame game="flip-happens" />
  );
}
