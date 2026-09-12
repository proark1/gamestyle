'use client';

import { useSyncExternalStore } from 'react';
import { CircleUserRound, UserRound } from 'lucide-react';
import AccountDialog from './AccountDialog';
import SignInDialog from './SignInDialog';
import {
  accountSnapshot,
  openAccountDialog,
  serverAccountSnapshot,
  subscribeAccount,
} from './client';
import './account.css';

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
  const { status, account, methods, dialog } = useSyncExternalStore(
    subscribeAccount,
    accountSnapshot,
    serverAccountSnapshot,
  );
  if (status === 'unknown' || (!account && !methods.google && !methods.email))
    return null;
  const label = account ? 'Your account' : 'Sign in';
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
            {account ? account.displayName || 'Your account' : 'Sign in'}
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
    </>
  );
}
