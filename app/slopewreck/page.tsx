import SlopewreckGame from '../../games/slopewreck/Game';
import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';

export const metadata = {
  title: 'Slopewreck — Jumbleyard',
  description:
    'Race down a changing mountain. Land snowboard tricks to build ramps and rails for the riders behind you. Play solo with bots or with up to four friends.',
};

export default async function Page() {
  return (await gamePageAccess('slopewreck')) ? (
    <SlopewreckGame />
  ) : (
    <LockedGame game="slopewreck" />
  );
}
