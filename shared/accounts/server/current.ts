import { getBinding } from '@/db/index';
import { accountConfig } from './config';
import { readSession, type SignedInAccount } from './session';

/** The signed-in account behind a request, for any server route that needs it. */
export async function currentAccount(
  request: Request,
): Promise<SignedInAccount | null> {
  const session = await readSession(request, {
    db: getBinding(),
    config: accountConfig(),
    now: Date.now(),
  });
  return session?.account ?? null;
}
