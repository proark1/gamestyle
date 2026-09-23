'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/shared/browser/api-fetch';

export default function PurchaseComplete() {
  const [message, setMessage] = useState('Checking your purchase…');
  const [done, setDone] = useState(false);
  useEffect(() => {
    const proof = new URLSearchParams(window.location.search).get('session_id');
    if (!proof) {
      queueMicrotask(() => setMessage('No checkout session was found.'));
      return;
    }
    void apiFetch('/api/account/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'verify_purchase', proof }),
      cache: 'no-store',
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error ?? 'We could not confirm this payment yet.',
          );
        window.history.replaceState({}, '', '/purchase/complete');
        setDone(true);
        setMessage('Purchase confirmed. Your items are ready in the wardrobe.');
      })
      .catch((error) =>
        setMessage(
          error instanceof Error
            ? error.message
            : 'Purchase confirmation is unavailable.',
        ),
      );
  }, []);
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#f7f2df',
        color: '#263b30',
      }}
    >
      <section
        style={{
          maxWidth: 460,
          padding: 28,
          borderRadius: 20,
          background: '#fffdf5',
          boxShadow: '0 12px 40px #263b3020',
        }}
      >
        <h1>{done ? 'Thanks for playing!' : 'Your purchase'}</h1>
        <output>{message}</output>
        <p>
          If payment completed, your items are saved to your account even if you
          close this page.
        </p>
        <Link href="/party">Return to the party</Link>
      </section>
    </main>
  );
}
