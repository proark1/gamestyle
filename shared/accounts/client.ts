import {
  ACCOUNT_CHANNEL,
  type AccountMessage,
  type AccountSummary,
  type SessionReply,
  type SignInMethods,
} from './types';

export type AccountDialogState = {
  kind: 'sign-in' | 'account';
  /** A note the dialog opens with, such as why sign-in did not finish. */
  notice?: string;
};

export type AccountState = {
  /** `unknown` until the server has answered once. */
  status: 'unknown' | 'ready';
  account: AccountSummary | null;
  methods: SignInMethods;
  dialog: AccountDialogState | null;
};

const INITIAL: AccountState = {
  status: 'unknown',
  account: null,
  methods: { google: false, email: false },
  dialog: null,
};

const LANDING_NOTICES: Record<string, string> = {
  failed: 'Google sign-in didn’t finish. Please try again.',
  cancelled: 'Google sign-in was cancelled.',
  unavailable: 'Google sign-in isn’t available right now.',
};

let state = INITIAL;
let loading: Promise<void> | undefined;
let channel: BroadcastChannel | undefined;
const subscribers = new Set<() => void>();
const messageListeners = new Set<(message: AccountMessage) => void>();

function publish(next: Partial<AccountState>) {
  state = { ...state, ...next };
  for (const notify of subscribers) notify();
}

/** Stable between changes, so useSyncExternalStore does not loop. */
export const accountSnapshot = () => state;

/** The server and the hydrating client both render without an account. */
export const serverAccountSnapshot = () => INITIAL;

export function subscribeAccount(notify: () => void) {
  subscribers.add(notify);
  listen();
  if (state.status === 'unknown') void refreshAccount();
  return () => {
    subscribers.delete(notify);
  };
}

/** Other tabs and the Google sign-in window announce changes on a channel. */
function listen() {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel(ACCOUNT_CHANNEL);
  channel.onmessage = (event: MessageEvent<AccountMessage>) => {
    for (const listener of messageListeners) listener(event.data);
    if (event.data?.type !== 'sign-in-failed') void refreshAccount(true);
  };
}

const announce = (type: AccountMessage['type']) =>
  channel?.postMessage({ type } satisfies AccountMessage);

export function onAccountMessage(listener: (message: AccountMessage) => void) {
  listen();
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
  };
}

/** Google sign-in without a popup comes back with its result in the address. */
function takeLandingNotice() {
  const result = /^#sign-in-(\w+)$/.exec(location.hash)?.[1];
  if (!result || !LANDING_NOTICES[result]) return undefined;
  history.replaceState(
    history.state,
    '',
    `${location.pathname}${location.search}`,
  );
  return LANDING_NOTICES[result];
}

/** Never rejects: a failed check leaves the player signed out. */
async function loadAccount(first: boolean) {
  try {
    const response = await fetch('/api/account/session', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Session answered ${response.status}`);
    const reply = (await response.json()) as SessionReply;
    const notice = first ? takeLandingNotice() : undefined;
    publish({
      status: 'ready',
      account: reply.account,
      methods: reply.methods,
      dialog: notice
        ? { kind: 'sign-in', notice }
        : reply.account && state.dialog?.kind === 'sign-in'
          ? null
          : state.dialog,
    });
  } catch {
    publish({ status: 'ready' });
  }
}

export function refreshAccount(force = false) {
  if (loading && !force) return loading;
  const load = loadAccount(state.status === 'unknown');
  loading = load;
  void load.then(() => {
    if (loading === load) loading = undefined;
  });
  return load;
}

export function openAccountDialog(notice?: string) {
  publish({ dialog: { kind: state.account ? 'account' : 'sign-in', notice } });
}

export function closeAccountDialog() {
  publish({ dialog: null });
}

export class AccountRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly remaining?: number,
  ) {
    super(message);
  }
}

async function send<T>(path: string, body: object): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AccountRequestError(
      'No connection. Check your internet and try again.',
      0,
    );
  }
  if (response.status === 204) return undefined as T;
  const reply = (await response.json().catch(() => ({}))) as Partial<{
    error: string;
    remaining: number;
  }>;
  if (!response.ok)
    throw new AccountRequestError(
      reply.error ?? 'Something went wrong. Please try again.',
      response.status,
      reply.remaining,
    );
  return reply as T;
}

export async function requestEmailCode(email: string) {
  await send('/api/account/email/start', { email });
}

export async function verifyEmailCode(email: string, code: string) {
  const { account } = await send<{ account: AccountSummary }>(
    '/api/account/email/verify',
    { email, code },
  );
  publish({ account, dialog: null });
  announce('signed-in');
}

export async function saveDisplayName(displayName: string) {
  const { account } = await send<{ account: AccountSummary }>(
    '/api/account/profile',
    { displayName },
  );
  publish({ account });
  announce('signed-in');
}

export async function signOut(everywhere = false) {
  await send('/api/account/sign-out', { everywhere });
  publish({ account: null, dialog: null });
  announce('signed-out');
}

export async function deleteAccount() {
  await send('/api/account/delete', { confirm: 'delete' });
  publish({ account: null, dialog: null });
  announce('signed-out');
}

/**
 * Starts Google sign-in. Inside a game a popup keeps the room alive; if the
 * browser blocks it, the page itself goes to Google and comes back.
 */
export function signInWithGoogle(popup: boolean) {
  const start = `/api/account/google/start?return=${encodeURIComponent(
    `${location.pathname}${location.search}`,
  )}`;
  if (popup) {
    listen();
    const width = 480,
      height = 640;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    const opened = window.open(
      `${start}&popup=1`,
      'jumbleyard-sign-in',
      `popup,width=${width},height=${height},left=${left},top=${top}`,
    );
    if (opened) {
      // If the window cannot report back, check again when the player returns.
      window.addEventListener('focus', () => void refreshAccount(true), {
        once: true,
      });
      return;
    }
  }
  location.assign(start);
}
