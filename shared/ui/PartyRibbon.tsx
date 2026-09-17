'use client';
/* oxlint-disable react/react-compiler */

import { useEffect, useState } from 'react';
import { Trophy, ArrowRight } from 'lucide-react';

export default function PartyRibbon() {
  const [partyCode, setPartyCode] = useState<string | null>(null);
  const [round, setRound] = useState<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const p = params.get('party');
    const r = params.get('round');
    if (p && /^[A-Z2-9]{6}$/i.test(p)) {
      setPartyCode(p.toUpperCase());
      setRound(r ? parseInt(r, 10) + 1 : 1);
    }
  }, []);

  if (!partyCode) return null;

  return (
    <aside
      aria-label="Party mode tournament status"
      style={{
        position: 'fixed',
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: 'rgba(41, 74, 67, 0.92)',
        backdropFilter: 'blur(8px)',
        color: '#fff',
        borderRadius: 24,
        padding: '6px 16px 6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        fontSize: 13,
        fontWeight: 700,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Trophy size={16} color="#f3bf50" />
        <span>
          Party Tournament <span style={{ opacity: 0.7 }}>•</span> Round {round}{' '}
          of 6
        </span>
      </div>

      <a
        href={`/party?room=${partyCode}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: '#ca8038',
          color: '#fff',
          textDecoration: 'none',
          padding: '4px 10px',
          borderRadius: 14,
          fontSize: 12,
          fontWeight: 800,
          transition: 'background-color 0.15s',
        }}
      >
        Party Standings <ArrowRight size={13} />
      </a>
    </aside>
  );
}
