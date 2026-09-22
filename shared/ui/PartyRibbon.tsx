'use client';
/* oxlint-disable react/react-compiler */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../browser/api-fetch';
import { looksLikeRoomCode } from '../rooms/identity';
import { useLanguage } from '../language/useLanguage';
import {
  applyAudioPreferences,
  loadAudioPreferences,
} from '../audio/preferences';
import {
  PARTY_RESULT_ATTRIBUTE,
  PARTY_ROUND_ATTRIBUTE,
  readPartyResult,
  type PartyResult,
} from './party-round';
import './party-ribbon.css';

const PREF_KEYS = [
  'stack-or-sink-prefs-v1',
  'wrong-floor-prefs-v1',
  'omb-prefs-v1',
  'tiptoe-prefs-v1',
  'brain-cells-prefs-v1',
  'load-bearing-prefs-v1',
  'reel-problems-prefs-v1',
  'uphill-delivery-prefs-v1',
  'act-natural-prefs-v1',
  'shelf-control-prefs-v1',
];
type Seat = { code: string; playerId: string; token: string; round: number };
/** Embedded games publish results and PTT events; the parent owns all party navigation. */
export default function PartyRibbon() {
  const { language } = useLanguage(),
    de = language === 'de';
  const [seat, setSeat] = useState<Seat | null>(null);
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<PartyResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed' | 'saved'>(
    'idle',
  );
  const [embedded, setEmbedded] = useState(false);
  const [missing, setMissing] = useState('');
  const sending = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(location.search),
      code = params.get('party')?.toUpperCase();
    if (!code || !looksLikeRoomCode(code)) return;
    setEmbedded(window.parent !== window);
    document.body.classList.add('jumbleyard-party-mode');
    if (window.parent !== window)
      document.body.classList.add('jumbleyard-party-embedded');
    try {
      const saved = JSON.parse(
        sessionStorage.getItem('jumbleyard-party-session-v1') ?? 'null',
      );
      if (saved?.code === code && saved?.playerId && saved?.token) {
        setSeat({
          code,
          playerId: saved.playerId,
          token: saved.token,
          round: Number(params.get('round') ?? 0),
        });
        for (const key of PREF_KEYS)
          try {
            localStorage.setItem(
              key,
              JSON.stringify({
                ...JSON.parse(localStorage.getItem(key) ?? '{}'),
                name: saved.name,
                color: saved.color,
              }),
            );
          } catch {}
      } else setMissing(code);
    } catch {
      setMissing(code);
    }
    const navigate = (event: MouseEvent) => {
      if (
        window.parent === window ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      if (!(event.target as Element)?.closest?.('a[href="/"]')) return;
      event.preventDefault();
      window.parent.postMessage(
        { type: 'party-open-menu', code },
        location.origin,
      );
    };
    document.addEventListener('click', navigate, true);
    return () => {
      document.removeEventListener('click', navigate, true);
      document.body.classList.remove(
        'jumbleyard-party-mode',
        'jumbleyard-party-embedded',
      );
    };
  }, []);
  useEffect(() => {
    const announce = () => {
      setReady(true);
      const code = new URLSearchParams(location.search)
        .get('party')
        ?.toUpperCase();
      if (code && window.parent !== window)
        window.parent.postMessage(
          { type: 'party-game-ready', code },
          location.origin,
        );
    };
    window.addEventListener('game:party-ready', announce);
    const sound = (event: StorageEvent) => {
      if (event.key === 'jumbleyard-audio-v1')
        applyAudioPreferences(loadAudioPreferences());
    };
    window.addEventListener('storage', sound);
    return () => {
      window.removeEventListener('game:party-ready', announce);
      window.removeEventListener('storage', sound);
    };
  }, []);
  useEffect(() => {
    if (!seat || !embedded) return;
    const held = new Set<string>();
    const key = (event: KeyboardEvent) => {
      if (!/^Key[A-Z]$/.test(event.code)) return;
      if (event.type === 'keydown') {
        if (
          event.repeat ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.isComposing ||
          (event.target as HTMLElement)?.closest?.(
            'input,textarea,select,[contenteditable="true"]',
          )
        )
          return;
        held.add(event.code);
      } else if (!held.delete(event.code)) return;
      window.parent.postMessage(
        {
          type: 'party-ptt',
          code: seat.code,
          event: event.type,
          keyCode: event.code,
        },
        location.origin,
      );
    };
    const reset = () => {
      held.clear();
      window.parent.postMessage(
        { type: 'party-ptt-reset', code: seat.code },
        location.origin,
      );
    };
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);
    window.addEventListener('blur', reset);
    return () => {
      reset();
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', key);
      window.removeEventListener('blur', reset);
    };
  }, [seat, embedded]);
  useEffect(() => {
    if (!seat) return;
    const check = () => {
      const found = readPartyResult(document);
      if (found) setResult(found);
      return !!found;
    };
    if (check()) return;
    const observer = new MutationObserver(() => {
      if (check()) observer.disconnect();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [PARTY_ROUND_ATTRIBUTE, PARTY_RESULT_ATTRIBUTE],
    });
    return () => observer.disconnect();
  }, [seat]);
  const send = useCallback(async () => {
    if (!seat || !result || sending.current) return;
    sending.current = true;
    setStatus('saving');
    try {
      const response = await apiFetch('/api/party', {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'report_result', ...seat, result }),
      });
      if (!response.ok) throw new Error('Result was not saved.');
      setStatus('saved');
      if (window.parent !== window)
        window.parent.postMessage(
          { type: 'party-round-finished', code: seat.code },
          location.origin,
        );
      else location.assign(`/party?room=${seat.code}`);
    } catch {
      sending.current = false;
      setStatus('failed');
    }
  }, [seat, result]);
  useEffect(() => {
    if (!result) return;
    // Leave time to see the game's ending before the shared result screen takes over.
    const timer = setTimeout(() => void send(), 1500);
    return () => clearTimeout(timer);
  }, [result, send]);
  if (missing)
    return (
      <div className="party-intro-overlay">
        <a
          href={`/party?room=${missing}`}
          target={embedded ? '_parent' : undefined}
        >
          {de
            ? 'Zur Party zurückkehren und erneut beitreten'
            : 'Return to the party and rejoin'}
        </a>
      </div>
    );
  if (!seat) return null;
  return (
    <>
      {!ready && (
        <div className="party-intro-overlay">
          <div className="party-intro-card">
            <strong>
              {de ? 'Deine Crew kommt gleich…' : 'Your crew is on the way…'}
            </strong>
            <output>
              {de
                ? 'Die Spielzeit wartet, bis alle verbunden sind.'
                : 'The game clock waits until everyone is connected.'}
            </output>
            <small>
              {de
                ? 'Bei Verbindungsproblemen: Partymenü → Erneut beitreten.'
                : 'Connection trouble? Party menu → Rejoin round.'}
            </small>
          </div>
        </div>
      )}
      {!embedded && (
        <a
          className="party-standalone-return"
          href={`/party?room=${seat.code}`}
        >
          {de ? 'Zur Party' : 'Back to party'}
        </a>
      )}
      {result && (
        <output className="party-completion-card">
          <span>
            {status === 'failed'
              ? de
                ? 'Das Ergebnis wurde nicht gespeichert. Bitte erneut versuchen.'
                : 'Your result did not save. Please retry.'
              : de
                ? 'Runde beendet — Ergebnis wird gespeichert…'
                : 'Round complete — saving your result…'}
          </span>
          {status === 'failed' && (
            <button onClick={() => void send()}>
              {de ? 'Ergebnis erneut speichern' : 'Retry saving result'}
            </button>
          )}
        </output>
      )}
    </>
  );
}
