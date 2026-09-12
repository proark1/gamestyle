'use client';

import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import {
  AccountRequestError,
  closeAccountDialog,
  deleteAccount,
  saveDisplayName,
  signOut,
} from './client';
import type { AccountSummary } from './types';

const PROVIDERS = { google: 'Google', email: 'Email code' };

export default function AccountDialog({
  account,
}: {
  account: AccountSummary;
}) {
  const [name, setName] = useState(account.displayName ?? '');
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const attempt = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await work();
    } catch (caught) {
      setError(
        caught instanceof AccountRequestError
          ? caught.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) closeAccountDialog();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="account-backdrop" />
        <Dialog.Popup className="account-dialog">
          <Dialog.Title className="account-title">Your account</Dialog.Title>
          <Dialog.Description className="account-description">
            You’re signed in with:
          </Dialog.Description>
          <ul className="account-identities">
            {account.identities.map((identity) => (
              <li key={`${identity.provider}:${identity.hint}`}>
                <span>{PROVIDERS[identity.provider]}</span>
                <span>{identity.hint}</span>
              </li>
            ))}
          </ul>
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <form
            className="account-form"
            onSubmit={(event) => {
              event.preventDefault();
              void attempt(async () => {
                await saveDisplayName(name);
                setSaved(true);
              });
            }}
          >
            <label className="account-label" htmlFor="account-name">
              Name <span className="account-optional">(optional)</span>
            </label>
            <input
              id="account-name"
              className="account-input"
              maxLength={18}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSaved(false);
              }}
            />
            <button className="account-secondary" type="submit" disabled={busy}>
              {saved ? 'Saved' : 'Save name'}
            </button>
          </form>
          <div className="account-actions">
            <button
              type="button"
              className="account-secondary"
              disabled={busy}
              onClick={() => void attempt(() => signOut(false))}
            >
              Sign out
            </button>
            <button
              type="button"
              className="account-secondary"
              disabled={busy}
              onClick={() => void attempt(() => signOut(true))}
            >
              Sign out everywhere
            </button>
          </div>
          <div className="account-danger-zone">
            {confirming ? (
              <form
                className="account-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void attempt(deleteAccount);
                }}
              >
                <label className="account-label" htmlFor="account-confirm">
                  Type <b>delete</b> to remove this account and everything saved
                  with it. This can’t be undone.
                </label>
                <input
                  id="account-confirm"
                  className="account-input"
                  autoComplete="off"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                />
                <div className="account-actions">
                  <button
                    type="button"
                    className="account-secondary"
                    onClick={() => {
                      setConfirming(false);
                      setTyped('');
                    }}
                  >
                    Keep account
                  </button>
                  <button
                    type="submit"
                    className="account-danger"
                    disabled={busy || typed.trim().toLowerCase() !== 'delete'}
                  >
                    Delete account
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="account-link account-link-danger"
                onClick={() => setConfirming(true)}
              >
                Delete account…
              </button>
            )}
          </div>
          <p className="account-fineprint">
            <a href="/privacy" target="_blank" rel="noopener">
              How we handle your data
            </a>
          </p>
          <Dialog.Close className="account-close" aria-label="Close">
            <X size={18} />
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
