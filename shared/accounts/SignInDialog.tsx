'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Mail, X } from 'lucide-react';
import {
  AccountRequestError,
  closeAccountDialog,
  onAccountMessage,
  requestEmailCode,
  signInWithGoogle,
  verifyEmailCode,
} from './client';
import type { SignInMethods } from './types';
import { CastGuide } from '../clubhouse/Cast';
import { CLUBHOUSE_COPY } from '../clubhouse/copy';
import { useLanguage } from '../language/useLanguage';

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function SignInDialog({
  methods,
  notice,
  popup,
}: {
  methods: SignInMethods;
  notice?: string;
  /** In a game, Google opens in a popup so the room stays connected. */
  popup: boolean;
}) {
  const { t } = useLanguage();
  const copy = t(CLUBHOUSE_COPY);
  const [step, setStep] = useState<'start' | 'code'>('start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(notice);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(
    () =>
      onAccountMessage((message) => {
        if (message.type !== 'sign-in-failed') return;
        setWaiting(false);
        setError(copy.googleError);
      }),
    [copy.googleError],
  );

  const attempt = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await work();
    } catch (caught) {
      setError(
        caught instanceof AccountRequestError
          ? caught.message
          : copy.genericError,
      );
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    attempt(async () => {
      await requestEmailCode(email);
      setCode('');
      setStep('code');
    });

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) closeAccountDialog();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="account-backdrop" />
        <Dialog.Popup className="account-dialog account-clubhouse">
          <CastGuide
            pose={step === 'code' ? 'mail' : 'wave'}
            message={step === 'code' ? 'code' : 'signIn'}
          />
          <Dialog.Title className="account-title">
            {step === 'code' ? copy.codeTitle : copy.joinTitle}
          </Dialog.Title>
          <Dialog.Description className="account-description">
            {step === 'code' ? (
              <>
                {copy.sentBefore} <b>{email}</b>. {copy.sentAfter}
              </>
            ) : (
              copy.signInHint
            )}
          </Dialog.Description>
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          {step === 'start' ? (
            <>
              {methods.google && (
                <button
                  type="button"
                  className="account-google"
                  disabled={busy || waiting}
                  onClick={() => {
                    setError(undefined);
                    if (popup) setWaiting(true);
                    signInWithGoogle(popup, () => setWaiting(false));
                  }}
                >
                  <GoogleMark />
                  {waiting ? copy.waiting : copy.google}
                </button>
              )}
              {methods.google && methods.email && (
                <div className="account-divider">{copy.or}</div>
              )}
              {methods.email && (
                <form
                  className="account-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendCode();
                  }}
                >
                  <label className="account-label" htmlFor="account-email">
                    {copy.email}
                  </label>
                  <input
                    id="account-email"
                    className="account-input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <button
                    className="account-primary"
                    type="submit"
                    disabled={busy}
                  >
                    <Mail size={17} />
                    {busy ? copy.sending : copy.send}
                  </button>
                </form>
              )}
            </>
          ) : (
            <form
              className="account-form"
              onSubmit={(event) => {
                event.preventDefault();
                void attempt(() => verifyEmailCode(email, code));
              }}
            >
              <label className="account-label" htmlFor="account-code">
                {copy.codeLabel}
              </label>
              <input
                id="account-code"
                className="account-input account-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
              />
              <button
                className="account-primary"
                type="submit"
                disabled={busy || code.length !== 6}
              >
                {busy ? copy.checking : copy.confirm}
              </button>
              <div className="account-links">
                <button
                  type="button"
                  className="account-link"
                  onClick={() => {
                    setStep('start');
                    setError(undefined);
                  }}
                >
                  {copy.different}
                </button>
                <button
                  type="button"
                  className="account-link"
                  disabled={busy}
                  onClick={() => void sendCode()}
                >
                  {copy.resend}
                </button>
              </div>
            </form>
          )}
          <Dialog.Close className="account-guest">{copy.guest}</Dialog.Close>
          <p className="account-fineprint">
            {copy.privacyNote}{' '}
            <a href="/privacy" target="_blank" rel="noopener">
              {copy.privacy}
            </a>
          </p>
          <Dialog.Close className="account-close" aria-label={copy.close}>
            <X size={18} />
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
