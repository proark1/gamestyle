'use client';
import { apiFetch } from '../browser/api-fetch';

/* oxlint-disable react/react-compiler, typescript/unbound-method */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Trophy,
  ArrowRight,
  Flag,
  LoaderCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { COLORS } from '../rendering/palette';
import { looksLikeRoomCode } from '../rooms/identity';
import {
  PARTY_RESULT_ATTRIBUTE,
  PARTY_ROUND_ATTRIBUTE,
  readPartyResult,
  type PartyResult,
} from './party-round';
import './party-ribbon.css';

const GAME_TITLES: Record<string, string> = {
  'stack-or-sink': 'Stack or Sink',
  'crane-clash': 'Crane Clash',
  'act-natural': 'Blend Business',
  'dont-wake-the-giant': 'Tiptoe Thieves',
  'drive-thru': 'Drive-Thru Static',
  'four-brain-cells': 'Four Brain Cells',
  'load-bearing': 'Load Bearing',
  'one-more-button': 'One More Button',
  'panic-curling': 'Panic Curling',
  'reel-problems': 'Reel Problems',
  'sample-stampede': 'Sample Stampede',
  'shelf-control': 'Shelf Control',
  'siege-and-desist': 'Siege & Desist',
  'uphill-delivery': 'Uphill Delivery',
  'wrong-floor': 'Wrong Floor',
  'zorb-clash': 'Zorb Clash',
  'carry-on-carnage': 'Carry-On Carnage',
  basketball: 'Court Clash',
  'bungee-doubles': 'Bungee Doubles',
  'scaffold-scramble': 'Scaffold Scramble',
  'chain-of-fools': 'Chain of Fools',
};

/** The slice of the party room the standings panel shows. */
type Standings = {
  status: string;
  players: {
    id: string;
    name: string;
    color: number;
    score: number;
    isBot?: boolean;
  }[];
  reports?: Record<string, unknown>;
};

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

export default function PartyRibbon() {
  const [partyCode, setPartyCode] = useState<string | null>(null);
  const [round, setRound] = useState<number>(0);
  const [gameTitle, setGameTitle] = useState<string>('Party Game');
  const [playerName, setPlayerName] = useState<string>('Player 1');
  const [playerColor, setPlayerColor] = useState<number>(0);
  const [playerId, setPlayerId] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [introVisible, setIntroVisible] = useState<boolean>(true);
  const [introFading, setIntroFading] = useState<boolean>(false);
  // The first result the game publishes; the round's result from then on.
  const [result, setResult] = useState<PartyResult | null>(null);
  const [report, setReport] = useState<'idle' | 'saving' | 'saved' | 'failed'>(
    'idle',
  );
  const [confirmGiveUp, setConfirmGiveUp] = useState<boolean>(false);
  const [leaving, setLeaving] = useState<boolean>(false);
  const [standingsOpen, setStandingsOpen] = useState<boolean>(false);
  const [standings, setStandings] = useState<Standings | null>(null);

  const reporting = useRef<Promise<boolean> | null>(null);

  // 1. Initialize party parameters from URL & sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const p = params.get('party');
    const r = params.get('round');

    if (!p || !looksLikeRoomCode(p)) {
      return;
    }

    const code = p.toUpperCase();
    const roundIdx = r ? parseInt(r, 10) : 0;
    setPartyCode(code);
    setRound(roundIdx);

    // Get current game name from path
    const path = window.location.pathname.replace(/^\/|\/$/g, '');
    const title = GAME_TITLES[path] || path || 'Party Game';
    setGameTitle(title);

    // Add class to body immediately to suppress start panels
    document.body.classList.add('jumbleyard-party-mode');

    // Read cached player identity from sessionStorage
    let resolvedName = 'Player 1';
    let resolvedColor = 0;
    // Written by the party page (app/party/PartyClient.tsx).
    try {
      const raw = sessionStorage.getItem('jumbleyard-party-session-v1');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.code === code) {
        if (parsed.name) {
          resolvedName = parsed.name;
          setPlayerName(parsed.name);
        }
        if (Number.isInteger(parsed.color)) {
          resolvedColor = parsed.color;
          setPlayerColor(parsed.color);
        }
        if (typeof parsed.playerId === 'string') {
          setPlayerId(parsed.playerId);
        }
        if (typeof parsed.token === 'string') {
          setToken(parsed.token);
        }
      }
    } catch {}

    // Pre-populate all local storage preferences
    for (const key of PREF_KEYS) {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        localStorage.setItem(
          key,
          JSON.stringify({
            ...saved,
            name: resolvedName,
            color: resolvedColor,
          }),
        );
      } catch {}
    }

    return () => {
      document.body.classList.remove('jumbleyard-party-mode');
    };
  }, []);

  // The host announces the authenticated shared round, independently of menu markup.
  useEffect(() => {
    const ready = () => {
      setIntroFading(true);
      setIntroVisible(false);
    };
    window.addEventListener('game:party-ready', ready);
    return () => window.removeEventListener('game:party-ready', ready);
  }, []);

  useEffect(() => {
    if (!partyCode || window.parent === window) return;
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
          code: partyCode,
          event: event.type,
          keyCode: event.code,
        },
        location.origin,
      );
    };
    const reset = () => {
      held.clear();
      window.parent.postMessage(
        { type: 'party-ptt-reset', code: partyCode },
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
  }, [partyCode]);
  // 3. Listen for round completion: every party game marks its root
  // `data-party-round="ended"` and publishes its result once its match is over
  // (see party-round.ts). Scores such as time left keep drifting after the
  // whistle, so the result is caught the moment it appears, and kept.
  useEffect(() => {
    if (!partyCode) return;

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
  }, [partyCode]);

  // 4. Report this player's result; null gives the round up. The party
  // scores the round once every human has reported.
  const sendReport = useCallback(
    (value: PartyResult | null): Promise<boolean> => {
      if (!partyCode || !playerId) return Promise.resolve(false);
      if (reporting.current) return reporting.current;
      setReport('saving');
      const sent = apiFetch('/api/party', {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'report_result',
          code: partyCode,
          round,
          playerId,
          token,
          result: value,
        }),
      })
        .then((res) => res.ok)
        .catch(() => false)
        .then((ok) => {
          setReport(ok ? 'saved' : 'failed');
          if (!ok) reporting.current = null;
          return ok;
        });
      reporting.current = sent;
      return sent;
    },
    [partyCode, playerId, token, round],
  );

  useEffect(() => {
    if (result) void sendReport(result);
  }, [result, sendReport]);

  // A saved result returns to the shared podium/vote automatically.
  useEffect(() => {
    if (report !== 'saved' || !partyCode) return;
    if (window.parent !== window)
      window.parent.postMessage(
        { type: 'party-round-finished', code: partyCode },
        location.origin,
      );
    else window.location.href = `/party?room=${partyCode}`;
  }, [report, partyCode]);

  // Standings open over the game: going to the party page mid-round would
  // send this player straight back into a fresh match.
  useEffect(() => {
    if (!standingsOpen || !partyCode) return;
    let live = true;
    const load = () =>
      apiFetch('/api/party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ op: 'get', code: partyCode }),
      })
        .then((res) => res.json())
        .then((data: { state?: Standings | null }) => {
          if (live && data.state) setStandings(data.state);
        })
        .catch(() => {});
    void load();
    const timer = setInterval(load, 3000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [standingsOpen, partyCode]);

  useEffect(() => {
    if (!confirmGiveUp) return;
    const timer = setTimeout(() => setConfirmGiveUp(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmGiveUp]);

  // 5. Head back to the standings, giving the round up if it isn't over
  const handleLeaveRound = useCallback(async () => {
    if (!partyCode || leaving) return;
    if (!result && !confirmGiveUp) {
      setConfirmGiveUp(true);
      return;
    }
    setLeaving(true);
    if (!(await sendReport(result))) {
      setLeaving(false);
      return;
    }
    if (window.parent !== window)
      window.parent.postMessage(
        { type: 'party-round-finished', code: partyCode },
        location.origin,
      );
    else window.location.href = `/party?room=${partyCode}`;
  }, [partyCode, leaving, result, confirmGiveUp, sendReport]);

  if (!partyCode) return null;

  return (
    <>
      {/* Tournament Intro & Loading Overlay */}
      {introVisible && (
        <div className={`party-intro-overlay ${introFading ? 'fade-out' : ''}`}>
          <div className="party-intro-card">
            <div className="party-intro-kicker">
              <Trophy size={18} /> Party Tournament
            </div>

            <div className="party-intro-title">Round {round + 1} of 6</div>

            <div
              style={{
                fontSize: 20,
                color: '#f3bf50',
                fontWeight: 800,
                fontFamily: 'Fredoka, sans-serif',
              }}
            >
              {gameTitle}
            </div>

            <div className="party-intro-player-pill">
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: COLORS[playerColor] || '#f3bf50',
                }}
              />
              Playing as <strong>{playerName}</strong>
            </div>

            <div className="party-intro-status">
              <LoaderCircle size={18} className="party-spin" />
              <span>Starting match…</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Floating Tournament Ribbon */}
      <aside
        className="party-ribbon-bar"
        aria-label="Party mode tournament status"
      >
        <div className="party-ribbon-badge">
          <Trophy size={16} />
          <span>Round {round + 1} of 6</span>
          <span className="party-ribbon-round-pill">{gameTitle}</span>
        </div>

        <div className="party-ribbon-actions">
          <button
            type="button"
            className="party-ribbon-btn party-ribbon-btn-standings"
            aria-expanded={standingsOpen}
            onClick={() => setStandingsOpen((open) => !open)}
          >
            Standings
          </button>

          <button
            type="button"
            className="party-ribbon-btn party-ribbon-btn-finish"
            onClick={() => void handleLeaveRound()}
            disabled={leaving}
          >
            {leaving ? (
              <LoaderCircle size={14} className="party-spin" />
            ) : result ? (
              <ArrowRight size={14} />
            ) : (
              <Flag size={14} />
            )}
            {leaving
              ? 'Saving…'
              : result
                ? 'View Standings'
                : confirmGiveUp
                  ? 'Tap again to give up'
                  : 'Give Up Round'}
          </button>
        </div>
      </aside>

      {standingsOpen && (
        <section
          className="party-standings-panel"
          aria-label="Tournament standings"
        >
          <header>
            <span>Standings</span>
            <button
              type="button"
              className="party-ribbon-btn party-ribbon-btn-standings"
              aria-label="Close standings"
              onClick={() => setStandingsOpen(false)}
            >
              <X size={14} />
            </button>
          </header>
          {standings ? (
            <ol>
              {[...standings.players]
                .sort((a, b) => b.score - a.score)
                .map((player, index) => (
                  <li key={player.id}>
                    <span>{index + 1}</span>
                    <span
                      className="party-standings-dot"
                      style={{ background: COLORS[player.color] ?? '#999' }}
                    />
                    <span className="party-standings-name">
                      {player.name}
                      {player.id === playerId ? ' (You)' : ''}
                    </span>
                    <span className="party-standings-state">
                      {player.isBot
                        ? 'Bot'
                        : standings.status !== 'countdown'
                          ? ''
                          : standings.reports?.[player.id] === undefined
                            ? 'Playing'
                            : standings.reports[player.id] === null
                              ? 'Gave up'
                              : 'Finished'}
                    </span>
                    <span className="party-standings-score">
                      {player.score} pts
                    </span>
                  </li>
                ))}
            </ol>
          ) : (
            <LoaderCircle size={16} className="party-spin" />
          )}
        </section>
      )}

      {/* In-Game Round Complete Toast */}
      {result && !leaving && (
        <div className="party-completion-card">
          <Sparkles size={20} color="#f3bf50" />
          <span>
            {report === 'saving'
              ? `Round ${round + 1} complete! Saving your result…`
              : report === 'failed'
                ? `Round ${round + 1} complete, but your result didn't save.`
                : `Round ${round + 1} complete! Ready for standings?`}
          </span>
          <button
            type="button"
            className="party-ribbon-btn party-ribbon-btn-finish"
            onClick={() => void handleLeaveRound()}
          >
            {report === 'failed' ? 'Retry & View Standings' : 'View Standings'}{' '}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}
