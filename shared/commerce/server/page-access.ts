import { headers } from 'next/headers';
import { getBinding } from '../../../db/index';
import { currentAccount } from '../../accounts/server/current';
import { accountCanPlay, paidAdmissionEnabled } from './access';

/** Server-rendered game routes use the same entitlement check as room admission. */
export async function gamePageAccess(game: string): Promise<boolean> {
  if (!paidAdmissionEnabled()) return true;
  const requestHeaders = await headers();
  const account = await currentAccount(
    new Request('https://jumbleyard.invalid/', { headers: requestHeaders }),
  );
  return accountCanPlay(getBinding(), game, account?.id ?? null);
}
