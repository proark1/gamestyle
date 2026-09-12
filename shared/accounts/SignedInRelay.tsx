'use client';

import { useEffect } from 'react';
import { ACCOUNT_CHANNEL, type AccountMessage } from './types';
import './account.css';

const RESULTS = {
  ok: {
    title: 'You’re signed in',
    text: 'This window closes by itself. If it stays open, close it and go back to your game.',
  },
  cancelled: {
    title: 'Sign-in cancelled',
    text: 'Nothing changed. Close this window to go back to your game.',
  },
  failed: {
    title: 'Sign-in didn’t finish',
    text: 'Close this window and try again from your game.',
  },
  unavailable: {
    title: 'Sign-in is unavailable',
    text: 'Google sign-in isn’t switched on right now. Close this window to go back.',
  },
};

export type RelayResult = keyof typeof RESULTS;

/** The Google sign-in popup's last page: it tells the game's tab and closes. */
export default function SignedInRelay({ result }: { result: RelayResult }) {
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(ACCOUNT_CHANNEL);
      channel.postMessage({
        type: result === 'ok' ? 'signed-in' : 'sign-in-failed',
      } satisfies AccountMessage);
      channel.close();
    }
    window.close();
  }, [result]);
  const { title, text } = RESULTS[result];
  return (
    <main className="account-relay">
      <div>
        <h1>{title}</h1>
        <p>{text}</p>
        <a href="/">Back to Jumbleyard</a>
      </div>
    </main>
  );
}
