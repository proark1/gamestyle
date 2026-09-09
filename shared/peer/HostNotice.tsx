'use client';
import { useEffect, useState } from 'react';
import type { VoiceSession } from '../voice/types';

export default function HostNotice({ session }: { session?: VoiceSession }) {
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!session?.peer) return;
    let timer: ReturnType<typeof setTimeout>;
    const receive = (event: Event) => {
      const detail = (
        event as CustomEvent<{ game: string; code: string; message: string }>
      ).detail;
      if (detail.game !== session.game || detail.code !== session.code) return;
      setMessage(detail.message);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(''), 6500);
    };
    window.addEventListener('gamestyle-peer-status', receive);
    return () => {
      window.removeEventListener('gamestyle-peer-status', receive);
      clearTimeout(timer);
    };
  }, [session?.game, session?.code, session?.peer]);
  return message ? (
    <output className="peer-host-notice" aria-live="polite">
      {message}
    </output>
  ) : null;
}
