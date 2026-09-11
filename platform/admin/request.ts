import { useEffect, useState } from 'react';

export type Params = Record<string, string | number | undefined>;

/** What every report panel needs: who is signed in and which period to show. */
export type Scope = {
  credential: string;
  from: number;
  tz: number;
  /** Changes when the admin asks for fresh numbers. */
  revision: number;
  signOut: () => void;
};

export class SignedOut extends Error {}

export async function adminFetch<T>(
  credential: string,
  params: Params,
  signal?: AbortSignal,
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== '') query.set(key, String(value));
  const response = await fetch(`/api/admin/analytics?${query}`, {
    headers: { 'x-audio-admin': credential },
    cache: 'no-store',
    signal,
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (response.status === 401)
    throw new SignedOut(body.error || 'Sign in again.');
  if (!response.ok)
    throw new Error(
      body.error || 'Reports are unavailable. Try again shortly.',
    );
  return body as T;
}

/** Loads a report and keeps showing the previous one while the next loads. */
export function useReport<T>(scope: Scope, params: Params | null) {
  const { credential, revision, signOut } = scope;
  const query = params ? JSON.stringify(params) : '';
  const key = query ? `${query}|${revision}` : '';
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error?: string;
  }>({ key: '' });
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    adminFetch<T>(
      credential,
      JSON.parse(query) as Params,
      controller.signal,
    ).then(
      (data) => setState({ key: `${query}|${revision}`, data }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof SignedOut) signOut();
        else
          setState((previous) => ({
            key: `${query}|${revision}`,
            data: previous.data,
            error:
              error instanceof Error
                ? error.message
                : 'Reports are unavailable.',
          }));
      },
    );
    return () => controller.abort();
  }, [credential, query, revision, signOut]);
  return {
    data: state.data,
    error: state.key === key ? state.error : undefined,
    loading: !!key && state.key !== key,
  };
}
