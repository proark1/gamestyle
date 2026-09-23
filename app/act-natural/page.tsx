import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
import ActNatural from '@/games/act-natural/Game';
export const metadata = {
  title: 'Blend Business — Jumbleyard',
  description:
    'Three of these cows are your friends. Blend into the herd, steal the keys and escape in three-minute rounds.',
};
export default async function Page() {
  return (await gamePageAccess('act-natural')) ? (
    <ActNatural />
  ) : (
    <LockedGame game="act-natural" />
  );
}
