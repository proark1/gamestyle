'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import styles from './admin.module.css';

const AudioRequest = createContext<typeof fetch>(fetch);
export const useAudioRequest = () => useContext(AudioRequest);

/** Signs workshop requests with a credential the server has already accepted. */
export function AudioRequestProvider({
  credential,
  children,
}: {
  credential: string;
  children: ReactNode;
}) {
  const fetchAudio = useCallback<typeof fetch>(
    (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set('x-audio-admin', credential);
      return fetch(input, { ...init, headers });
    },
    [credential],
  );
  return <AudioRequest value={fetchAudio}>{children}</AudioRequest>;
}

export default function AdminAccess({
  endpoint,
  children,
}: {
  endpoint: string;
  children: ReactNode;
}) {
  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${endpoint}?access`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error('The workshop is unavailable. Try again shortly.');
        const access = (await response.json()) as { configured: boolean };
        setConfigured(access.configured);
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [endpoint]);
  if (credential)
    return (
      <AudioRequestProvider credential={credential}>
        {children}
      </AudioRequestProvider>
    );
  return (
    <main className={styles.page}>
      <h1>Sound workshop</h1>
      <p>Sign in to edit sounds and generate recordings.</p>
      {configured === false ? (
        <p>
          Administrator access has not been configured. Game audio is still
          available.
        </p>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              const encoded = encodeURIComponent(password);
              const response = await fetch(`${endpoint}?access`, {
                headers: { 'x-audio-admin': encoded },
                cache: 'no-store',
              });
              if (!response.ok)
                throw new Error(
                  'The workshop is unavailable. Try again shortly.',
                );
              const access = (await response.json()) as { authorized: boolean };
              if (!access.authorized)
                throw new Error('The administrator password is incorrect.');
              setCredential(encoded);
              setPassword('');
            } catch (error) {
              setError(
                error instanceof Error ? error.message : 'Sign-in failed.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="audio-admin-password">Administrator password</label>
          <input
            id="audio-admin-password"
            type="password"
            autoComplete="current-password"
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button disabled={busy || configured !== true || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <p>
        <a href="/">All games</a>
      </p>
    </main>
  );
}
