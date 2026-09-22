'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { CircleUserRound, UserRound, X } from 'lucide-react';
import AccountDialog from './AccountDialog';
import SignInDialog from './SignInDialog';
import {
  accountSnapshot,
  openAccountDialog,
  serverAccountSnapshot,
  subscribeAccount,
} from './client';
import './account.css';
import { useLanguage } from '../language/useLanguage';
import { CLUBHOUSE_COPY } from '../clubhouse/copy';
import { CastGuide } from '../clubhouse/Cast';

/**
 * The sign-in or account button. It stays hidden until the server reports a
 * configured sign-in method, and it owns the account dialogs: one per page.
 */
export default function AccountButton({
  variant,
}: {
  /** `toolbar` is the round in-game button; `header` the landing page's pill. */
  variant: 'toolbar' | 'header';
}) {
  const { t } = useLanguage();
  const copy = t(CLUBHOUSE_COPY);
  const [welcome, setWelcome] = useState(false);
  useEffect(() => {
    let previous = accountSnapshot();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeAccount(() => {
      const next = accountSnapshot();
      if (
        !previous.account &&
        previous.dialog?.kind === 'sign-in' &&
        next.account
      ) {
        setWelcome(true);
        clearTimeout(timer);
        timer = setTimeout(() => setWelcome(false), 6500);
      }
      previous = next;
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);
  const { status, account, methods, dialog } = useSyncExternalStore(
    subscribeAccount,
    accountSnapshot,
    serverAccountSnapshot,
  );
  if (status === 'unknown' || (!account && !methods.google && !methods.email))
    return null;
  const label = account ? copy.accountLabel : copy.confirm;
  return (
    <>
      <button
        type="button"
        className={
          variant === 'toolbar'
            ? 'game-toolbar-button account-toolbar-button'
            : 'account-header-button'
        }
        data-signed-in={account ? 'true' : 'false'}
        onClick={() => openAccountDialog()}
        aria-label={label}
        title={label}
      >
        {account ? <CircleUserRound size={19} /> : <UserRound size={19} />}
        {variant === 'header' && (
          <span>
            {account ? account.displayName || copy.accountLabel : copy.confirm}
          </span>
        )}
      </button>
      {dialog?.kind === 'sign-in' && !account && (
        <SignInDialog
          methods={methods}
          notice={dialog.notice}
          popup={variant === 'toolbar'}
        />
      )}
      {dialog?.kind === 'account' && account && (
        <AccountDialog account={account} />
      )}
      {welcome && account && (
        <aside className="account-welcome" aria-live="polite">
          <CastGuide pose="cheer" message="account" />
          <button
            type="button"
            aria-label={copy.close}
            onClick={() => setWelcome(false)}
          >
            <X size={16} />
          </button>
        </aside>
      )}
    </>
  );
}
