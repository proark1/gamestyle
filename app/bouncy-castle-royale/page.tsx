import CastleGame from '../../games/bouncy-castle-royale/Game';
import LockedGame from '@/shared/commerce/LockedGame';
import { gamePageAccess } from '@/shared/commerce/server/page-access';
export const metadata = {
  title: 'Bouncy Castle Royale — Jumbleyard',
  description:
    'Chaotic 2v2 inflatable volleyball. Bounce, volley, launch your friends and share the team’s air. Play solo with bots or with up to four friends.',
};
export default async function Page() {
  return (await gamePageAccess('bouncy-castle-royale')) ? (
    <CastleGame />
  ) : (
    <LockedGame game="bouncy-castle-royale" />
  );
}
