import { headers } from 'next/headers';
import { getBinding } from '../../../db/index';
import type { Game } from '../../games/identity';
import { currentAccount } from '../../accounts/server/current';
import { hasGameAccess } from '../catalog';
import { accountCanPlay } from './access';

export async function gamePageAccess(game: Game) {
  if (hasGameAccess(game, false)) return true;

  const incoming = await headers();
  if (!incoming.get('cookie')) return false;

  const request = new Request('https://jumbleyard.local', {
    headers: incoming,
  });
  const account = await currentAccount(request);
  return accountCanPlay(getBinding(), game, account?.id ?? null);
}
