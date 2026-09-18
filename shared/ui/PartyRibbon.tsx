'use client';
/* oxlint-disable react/react-compiler, typescript/unbound-method */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Trophy, ArrowRight, Flag, LoaderCircle, Sparkles } from 'lucide-react';
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
  const [introVisible, setIntroVisible] = useState<boolean>(true);
  const [introFading, setIntroFading] = useState<boolean>(false);
  // The first result the game publishes; the round's result from then on.
  const [result, setResult] = useState<PartyResult | null>(null);
  const [report, setReport] = useState<'idle' | 'saving' | 'saved' | 'failed'>(
    'idle',
  );
  const [confirmGiveUp, setConfirmGiveUp] = useState<boolean>(false);
  const [leaving, setLeaving] = useState<boolean>(false);

  const autoStarted = useRef<boolean>(false);
  const attempts = useRef<number>(0);
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

  // 2. Auto-fill and auto-start logic loop
  useEffect(() => {
    if (!partyCode || autoStarted.current) return;

    const interval = setInterval(() => {
      attempts.current++;

      // A. Populate any name input currently in the DOM
      const nameInputs = document.querySelectorAll<HTMLInputElement>(
        'input#player-name, input#hotel-name, input#omb-name, input#giant-name, input#lb-name, input#delivery-name, input#farm-name, input#shelf-name, input#sad-name, .hotel-field input, .omb-name input, .brain-name input, .reel-name input',
      );
      for (const input of nameInputs) {
        if (input.value !== playerName) {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value',
          )?.set;
          setter?.call(input, playerName);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // B. Look for the practice/solo/start buttons
      let clicked = false;

      // 1. Direct class matches
      const directButtons = document.querySelectorAll<HTMLButtonElement>(
        'button.practice-link, button.giant-text-button, button.cc-btn.primary, button.bb-btn.primary, button.sc-btn.primary, .cof-welcome button.cof-btn.primary',
      );
      for (const btn of directButtons) {
        if (!btn.disabled && !btn.hasAttribute('disabled')) {
          btn.click();
          clicked = true;
          break;
        }
      }

      // 2. Secondary menu buttons (e.g. Try with 3 NPCs, Try solo)
      if (!clicked) {
        const secondaryBtns = document.querySelectorAll<HTMLButtonElement>(
          '.hotel-secondary button, .omb-menu-secondary button, .brain-menu-secondary button, .reel-menu-secondary button, .delivery-setup-row button',
        );
        for (const btn of secondaryBtns) {
          if (!btn.disabled && !btn.hasAttribute('disabled')) {
            const txt = (btn.textContent || '').toLowerCase();
            if (/solo|npc|practice/i.test(txt)) {
              btn.click();
              clicked = true;
              break;
            }
          }
        }
      }

      // 3. Fallback to primary create buttons if solo/practice not found
      if (!clicked) {
        const primaryBtns = document.querySelectorAll<HTMLButtonElement>(
          'button.primary-button, button.hotel-primary, button.omb-primary, button.giant-primary, button.brain-primary, button.reel-primary, button.delivery-primary',
        );
        for (const btn of primaryBtns) {
          if (!btn.disabled && !btn.hasAttribute('disabled')) {
            btn.click();
            clicked = true;
            break;
          }
        }
      }

      // 4. If game starts immediately without start panel (e.g. Curling, Bungee, Zorb, Stampede, CarryOn)
      const hasActiveCanvas = !!document.querySelector(
        'canvas, .bb-canvas, .cc-canvas, .sc-canvas, .cof-canvas, .curling-viewport, .stampede-canvas-wrapper, .zorb-radar',
      );
      const startPanelExists = !!document.querySelector(
        '.start-panel, .hotel-menu, .omb-menu, .giant-menu, .giant-setup, .brain-menu, .setup-card, .reel-menu, .delivery-setup, .farm-menu, .cc-welcome, .bb-welcome, .sc-welcome, .cof-welcome',
      );

      if (
        clicked ||
        (!startPanelExists && hasActiveCanvas && attempts.current > 3)
      ) {
        autoStarted.current = true;
        clearInterval(interval);
        // Fade out overlay after short moment
        setTimeout(() => {
          setIntroFading(true);
          setTimeout(() => {
            setIntroVisible(false);
          }, 500);
        }, 500);
      }

      // Give up after 80 attempts (8 seconds)
      if (attempts.current > 80) {
        clearInterval(interval);
        setIntroFading(true);
        setTimeout(() => setIntroVisible(false), 500);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [partyCode, playerName]);

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
      const sent = fetch('/api/party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'report_result',
          code: partyCode,
          round,
          playerId,
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
    [partyCode, playerId, round],
  );

  useEffect(() => {
    if (result) void sendReport(result);
  }, [result, sendReport]);

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
    await sendReport(result);
    window.location.href = `/party?room=${partyCode}`;
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
          <a
            href={`/party?room=${partyCode}`}
            className="party-ribbon-btn party-ribbon-btn-standings"
          >
            Standings
          </a>

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
