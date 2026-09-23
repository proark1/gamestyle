import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import BasketballGame from '@/games/basketball/Game';

export const metadata = {
  title: 'Court Clash — Jumbleyard',
  description:
    'Two on two street basketball in the Jumbleyard style! Dribble, pass, sink threes, and charge up the combo meter for high-flying super jumps and slam dunks.',
};

export default async function Page() {
  return (await gamePageAccess('basketball')) ? (
    <BasketballGame />
  ) : (
    <LockedGame game="basketball" />
  );
}
