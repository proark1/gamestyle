'use client';
import VoicePanel from '../../shared/voice/VoicePanel';
import '../../shared/ui/toolbar.css';
import type { VoiceSession, VoiceSnapshot } from '../../shared/voice/types';
import { apiFetch } from '../../shared/browser/api-fetch';
import { publicGameOrigin } from '../../shared/browser/public-url';

/* oxlint-disable react/react-compiler */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Gamepad2,
  Users,
  Copy,
  Check,
  Play,
  Bot,
  UserPlus,
  ArrowRight,
  RotateCcw,
  LogOut,
  Sparkles,
  X,
} from 'lucide-react';
import { COLORS } from '@/shared/rendering/palette';
import { getPartyGameInfo } from '@/platform/party/playlist';
import {
  createParty,
  joinParty,
  getParty,
  togglePartyReady,
  addPartyBot,
  removePartyPlayer,
  startParty,
  rematchParty,
  leaveParty,
  closePartyRound,
} from '@/platform/party/client';
import type {
  PartyPass,
  PartyPlayer,
  PartyRoomState,
} from '@/platform/party/types';
import PartyPodium from './PartyPodium';
import PartyIntermission from './PartyIntermission';
import './party.css';
import { CastGuide } from '@/shared/clubhouse/Cast';
import './party-intermission.css';

const SESSION_KEY = 'jumbleyard-party-session-v1';

type PartyVoiceProps = { session: VoiceSession; snapshot: VoiceSnapshot };
export default function PartyClient({ initialCode }: { initialCode?: string }) {
  const [voice, setVoice] = useState<PartyVoiceProps | null>(null);
  return (
    <>
      <PartyClientBody initialCode={initialCode} onVoice={setVoice} />
      {voice && (
        <div className="party-voice game-toolbar">
          <VoicePanel {...voice} />
        </div>
      )}
    </>
  );
}
function PartyClientBody({
  initialCode,
  onVoice,
}: {
  initialCode?: string;
  onVoice: (value: PartyVoiceProps | null) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(0);
  const [joinCode, setJoinCode] = useState(initialCode ?? '');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [playerId, setPlayerId] = useState<string | null>(null);
  // The secret that proves this browser holds the seat; sessions saved
  // before passes existed have none.
  const [token, setToken] = useState('');
  const [room, setRoom] = useState<PartyRoomState | null>(null);
  const [gameFrame, setGameFrame] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [connectionError, setConnectionError] = useState('');
  const clock = useRef({ server: Date.now(), local: Date.now() });
  const latestRoomTime = useRef(0);
  const latestRevision = useRef(0);
  const acceptRoom = useCallback((fresh: PartyRoomState) => {
    const stamp = fresh.serverNow ?? fresh.updated;
    const revision = fresh.revision ?? 0;
    if (
      revision < latestRevision.current ||
      (revision === latestRevision.current && stamp < latestRoomTime.current)
    )
      return;
    latestRevision.current = revision;
    latestRoomTime.current = stamp;
    clock.current = {
      server: fresh.serverNow ?? Date.now(),
      local: Date.now(),
    };
    setRoom(fresh);
  }, []);

  // Load saved name/color from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('stack-or-sink-prefs-v1') || '{}',
      );
      if (typeof saved.name === 'string' && saved.name.trim()) {
        setName(saved.name.trim());
      }
      if (Number.isInteger(saved.color)) {
        setColor(Math.max(0, Math.min(3, saved.color)));
      }
    } catch {}
  }, []);

  // Restore session from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.code && saved?.playerId) {
          setPlayerId(saved.playerId);
          if (typeof saved.token === 'string') setToken(saved.token);
          void getParty(saved.code).then((st) => {
            if (st) acceptRoom(st);
          });
        }
      }
    } catch {}
  }, [acceptRoom]);

  // Save session to sessionStorage
  useEffect(() => {
    if (room?.code && playerId) {
      try {
        const me = room.players.find((p) => p.id === playerId);
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            code: room.code,
            playerId,
            token,
            name: me?.name ?? name,
            color: me?.color ?? color,
            isHost: room.hostId === playerId,
          }),
        );
      } catch {}
    }
  }, [room?.code, room?.players, room?.hostId, playerId, token, name, color]);

  // Serial polling avoids overlapping requests and updates clocks after reconnect.
  useEffect(() => {
    if (!room?.code) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const fetchState = async () => {
      const fresh = await getParty(room.code);
      if (!live) return;
      if (fresh) {
        acceptRoom(fresh);
        setConnectionError('');
      } else {
        setConnectionError('Connection interrupted. Retrying automatically…');
      }
      timer = setTimeout(fetchState, 750);
    };
    void fetchState();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [room?.code, acceptRoom]);

  // This player has already reported their result for the round in play.
  const reported =
    !!playerId &&
    room?.status === 'countdown' &&
    room.reports?.[playerId] !== undefined;

  useEffect(() => {
    onVoice(
      room && playerId && token
        ? {
            session: { game: 'party', code: room.code, id: playerId, token },
            snapshot: {
              players: room.players
                .filter((p) => !p.isBot)
                .map((p) => ({ id: p.id, name: p.name })),
              nearby: false,
            },
          }
        : null,
    );
  }, [room, playerId, token, onVoice]);
  const partyCode = room?.code,
    partyRound = room?.currentRound,
    partyStatus = room?.status,
    countdownUntil = room?.countdownUntil;
  useEffect(() => {
    const received = (event: MessageEvent) => {
      if (
        !partyCode ||
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow ||
        event.data?.code !== partyCode
      )
        return;
      if (event.data.type === 'party-round-finished') {
        void getParty(partyCode).then((fresh) => {
          if (fresh) acceptRoom(fresh);
          setGameFrame('');
        });
      } else if (
        event.data.type === 'party-ptt' &&
        ['keydown', 'keyup'].includes(event.data.event) &&
        /^Key[A-Z]$/.test(event.data.keyCode)
      ) {
        window.dispatchEvent(
          new KeyboardEvent(event.data.event, {
            code: event.data.keyCode,
            key: event.data.keyCode.slice(3),
            bubbles: true,
          }),
        );
      } else if (event.data.type === 'party-ptt-reset')
        window.dispatchEvent(new Event('game:voice-reset-talk'));
    };
    window.addEventListener('message', received);
    return () => window.removeEventListener('message', received);
  }, [partyCode, acceptRoom]);
  const currentGame = room?.playlist[room.currentRound];
  useEffect(() => {
    window.dispatchEvent(new Event('game:voice-reset-talk'));
  }, [gameFrame]);
  useEffect(() => {
    if (
      gameFrame &&
      (reported ||
        partyStatus !== 'countdown' ||
        Number(new URLSearchParams(gameFrame.split('?')[1]).get('round')) !==
          partyRound)
    )
      setGameFrame('');
  }, [gameFrame, reported, partyStatus, partyRound]);
  useEffect(() => {
    if (
      !partyCode ||
      partyStatus !== 'countdown' ||
      !countdownUntil ||
      reported ||
      gameFrame ||
      !playerId ||
      !token ||
      !currentGame
    )
      return;
    let live = true,
      launching = false;
    const timer = setInterval(() => {
      const left =
        countdownUntil! -
        (clock.current.server + Date.now() - clock.current.local);
      setCountdown(Math.max(0, Math.ceil(left / 1000)));
      if (left > 0 || launching) return;
      launching = true;
      void apiFetch('/api/party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          op: 'game_session',
          code: partyCode,
          round: partyRound,
          playerId,
          token,
        }),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok)
            throw new Error(data.error ?? 'Could not join the party round.');
          if (!live) return;
          sessionStorage.setItem(
            'jumbleyard:party-game',
            JSON.stringify({
              party: partyCode,
              round: partyRound,
              session: data.session,
            }),
          );
          setGameFrame(
            '/' + currentGame + '?party=' + partyCode + '&round=' + partyRound,
          );
          setConnectionError('');
        })
        .catch((error) => {
          if (live) setConnectionError(error.message);
        })
        .finally(() => {
          launching = false;
        });
    }, 500);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [
    partyCode,
    partyStatus,
    countdownUntil,
    partyRound,
    currentGame,
    reported,
    gameFrame,
    playerId,
    token,
  ]);

  const isHost = room?.hostId === playerId;
  const pass: PartyPass | null = playerId ? { id: playerId, token } : null;
  const me = room?.players.find((p) => p.id === playerId);

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await createParty(name || 'Player 1', color);
      setPlayerId(res.playerId);
      setToken(res.token);
      acceptRoom(res.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create party.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (busy || !joinCode.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await joinParty(
        joinCode.trim().toUpperCase(),
        name || 'Player',
        color,
      );
      setPlayerId(res.playerId);
      setToken(res.token);
      acceptRoom(res.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join party.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = () => {
    if (!room) return;
    const url = `${publicGameOrigin()}/party?room=${room.code}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleToggleReady = async () => {
    if (!room || !pass) return;
    try {
      const next = await togglePartyReady(room.code, pass, !me?.ready);
      acceptRoom(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle ready.');
    }
  };

  const handleAddBot = async () => {
    if (!room || !pass || !isHost) return;
    try {
      const next = await addPartyBot(room.code, pass);
      acceptRoom(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add bot.');
    }
  };

  const handleKick = async (targetId: string) => {
    if (!room || !pass || !isHost) return;
    try {
      const next = await removePartyPlayer(room.code, pass, targetId);
      acceptRoom(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove player.');
    }
  };

  const handleStart = async () => {
    if (!room || !pass || !isHost) return;
    try {
      const next = await startParty(room.code, pass);
      acceptRoom(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start party.');
    }
  };

  const handleCloseRound = async () => {
    if (!room || !pass || !isHost) return;
    try {
      acceptRoom(await closePartyRound(room.code, room.currentRound, pass));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close round.');
    }
  };

  const handleRematch = async () => {
    if (!room || !pass || !isHost) return;
    try {
      const next = await rematchParty(room.code, pass);
      acceptRoom(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not trigger rematch.',
      );
    }
  };

  const handleLeave = async () => {
    if (!room || !pass) return;
    try {
      await leaveParty(room.code, pass);
    } catch {}
    sessionStorage.removeItem(SESSION_KEY);
    latestRoomTime.current = 0;
    latestRevision.current = 0;
    setRoom(null);
    setPlayerId(null);
    setToken('');
  };

  const giveUpRound = async () => {
    if (!room || !playerId || busy) return;
    setBusy(true);
    try {
      const response = await apiFetch('/api/party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          op: 'report_result',
          code: room.code,
          playerId,
          token,
          round: room.currentRound,
          result: null,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? 'Could not return to the party.');
      acceptRoom(data.state);
      setGameFrame('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };
  if (gameFrame)
    return (
      <div className="party-game-shell">
        <iframe
          ref={frame}
          className="party-game-frame"
          title="Shared party round"
          src={gameFrame}
          allow="autoplay; microphone; fullscreen; gamepad"
        />
        <div className="party-game-exit">
          <button
            type="button"
            disabled={busy}
            onClick={() => void giveUpRound()}
          >
            Give up round · Back to party
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
        <p className="sr-only">
          Voice stays connected while your party changes games.
        </p>
      </div>
    );
  // 1. NOT IN A ROOM YET
  if (!room) {
    return (
      <div className="party-root">
        <header className="party-header">
          <a className="party-brand" href="/">
            <span className="party-brand-icon">
              <Gamepad2 size={22} color="#294a43" />
            </span>
            JUMBLEYARD<span style={{ color: '#ca8038' }}>.</span>
          </a>
          <span className="party-badge">🎉 PARTY TOURNAMENT</span>
        </header>

        <main className="party-main">
          <div className="party-title-wrap">
            <h1 className="party-title">Party Mode Tournament</h1>
            <CastGuide
              pose="wave"
              message="partyEntry"
              className="party-cast-guide"
            />
            <p className="party-subtitle">
              Assemble 4 players, vote your way through 6 mini-games, and crown
              the Party Champion!
            </p>
          </div>

          <div className="party-card">
            {error && (
              <div
                style={{
                  color: '#c0392b',
                  fontWeight: 700,
                  marginBottom: 20,
                  textAlign: 'center',
                }}
              >
                {error}
              </div>
            )}

            <div className="party-form-grid">
              {/* Host / Create Panel */}
              <div className="party-panel">
                <h2>
                  <Sparkles size={20} color="#ca8038" /> Create a Waiting Room
                </h2>
                <div className="party-input-group">
                  <label htmlFor="host-name">Your Name</label>
                  <input
                    id="host-name"
                    className="party-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Captain Chaos"
                    maxLength={18}
                  />
                </div>
                <div className="party-input-group">
                  <span className="party-input-group-title" id="outfit-label">
                    Your Outfit Color
                  </span>
                  <div
                    className="party-color-picker"
                    aria-labelledby="outfit-label"
                  >
                    {COLORS.map((c, i) => (
                      <button
                        key={c}
                        type="button"
                        className={`party-color-dot ${color === i ? 'selected' : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setColor(i)}
                        aria-label={`Color ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="party-btn party-btn-primary"
                  onClick={handleCreate}
                  disabled={busy}
                >
                  <UserPlus size={18} /> Create Party Room
                </button>
              </div>

              {/* Join Existing Panel */}
              <div className="party-panel">
                <h2>
                  <Users size={20} color="#679e99" /> Join With Room Code
                </h2>
                <div className="party-input-group">
                  <label htmlFor="join-code">6-Letter Room Code</label>
                  <input
                    id="join-code"
                    className="party-input"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ABCDEF"
                    maxLength={6}
                  />
                </div>
                <div className="party-input-group">
                  <label htmlFor="guest-name">Your Name</label>
                  <input
                    id="guest-name"
                    className="party-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Lucky Duck"
                    maxLength={18}
                  />
                </div>
                <button
                  type="button"
                  className="party-btn party-btn-secondary"
                  onClick={handleJoin}
                  disabled={busy || !joinCode.trim()}
                >
                  Join Party <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 2. WAITING FOR THE OTHERS TO FINISH THE ROUND
  if (reported) {
    const currentGameId = room.playlist[room.currentRound];
    const info = currentGameId ? getPartyGameInfo(currentGameId) : undefined;
    const humans = room.players.filter((p) => !p.isBot);
    return (
      <div className="party-root">
        <header className="party-header">
          <span className="party-brand">
            <span className="party-brand-icon">
              <Gamepad2 size={22} color="#294a43" />
            </span>
            JUMBLEYARD
          </span>
          <span className="party-badge">
            ROUND {room.currentRound + 1} OF 6
          </span>
        </header>

        <main className="party-main">
          <div className="party-title-wrap">
            <h1 className="party-title">
              {room.reports?.[playerId] === null
                ? 'You gave up this round'
                : 'Your result is in'}
            </h1>
            <p className="party-subtitle">
              {info?.name ?? 'This round'} is scored as soon as everyone has
              finished.
            </p>
          </div>

          <div className="party-card">
            {error && (
              <div
                style={{
                  color: '#c0392b',
                  fontWeight: 700,
                  marginBottom: 20,
                  textAlign: 'center',
                }}
              >
                {error}
              </div>
            )}

            <table className="party-standings-table">
              <tbody>
                {humans.map((player) => {
                  const report = room.reports?.[player.id];
                  return (
                    <tr key={player.id}>
                      <td>
                        <div
                          className="party-player-name-cell"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                          }}
                        >
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              backgroundColor: COLORS[player.color] ?? '#999',
                              display: 'inline-block',
                            }}
                          />
                          {player.name}
                          {player.id === playerId && (
                            <span style={{ color: '#ca8038', fontSize: 12 }}>
                              (You)
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: '#557065', fontWeight: 700 }}>
                        {report === undefined
                          ? 'Still playing…'
                          : report === null
                            ? 'Gave up'
                            : '✓ Finished'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                marginTop: 20,
                gap: 12,
              }}
            >
              <button
                type="button"
                className="party-btn party-btn-ghost"
                onClick={handleLeave}
              >
                <LogOut size={18} /> Leave Party
              </button>

              {isHost ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <span style={{ color: '#71806b', fontSize: 13 }}>
                    Anyone still playing counts as giving up.
                  </span>
                  <button
                    type="button"
                    className="party-btn party-btn-primary"
                    onClick={handleCloseRound}
                  >
                    Score the Round Now <ArrowRight size={18} />
                  </button>
                </div>
              ) : (
                <span style={{ color: '#71806b', fontWeight: 600 }}>
                  Waiting for the others to finish…
                </span>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 3. COUNTDOWN VIEW
  if (room.status === 'countdown') {
    const currentGameId = room.playlist[room.currentRound];
    const info = currentGameId ? getPartyGameInfo(currentGameId) : undefined;
    return (
      <div className="party-root">
        <header className="party-header">
          <span className="party-brand">
            <span className="party-brand-icon">
              <Gamepad2 size={22} color="#294a43" />
            </span>
            JUMBLEYARD
          </span>
          <span className="party-badge">
            ROUND {room.currentRound + 1} OF 6
          </span>
        </header>

        <main className="party-main">
          <div className="party-card party-countdown-wrap">
            <div className="party-countdown-number">{countdown ?? 'GO!'}</div>
            <h1 className="party-title">{info?.name ?? 'Next Mini-Game'}</h1>
            <p
              className="party-subtitle"
              style={{ fontSize: 18, marginBottom: 30 }}
            >
              {info?.tagline}
            </p>
            <div style={{ color: '#557065', fontWeight: 600 }}>
              Launching game for all 4 players…
            </div>
          </div>
        </main>
      </div>
    );
  }

  // The server owns the phase and winner; this view animates its snapshot.
  if (room.status === 'intermission') {
    return (
      <PartyIntermission
        room={room}
        pass={pass}
        onRoom={acceptRoom}
        onLeave={handleLeave}
        connectionError={connectionError}
      />
    );
  }

  // 5. GRAND FINALE / WINNER PODIUM
  if (room.status === 'finished') {
    const podium = room.players
      .filter((p) => !room.runId || !p.isBot)
      .sort((a, b) => b.score - a.score);
    const champions = podium.filter(
      (player) => player.score === podium[0]?.score,
    );

    return (
      <div className="party-root">
        <header className="party-header">
          <span className="party-brand">
            <span className="party-brand-icon">
              <Gamepad2 size={22} color="#294a43" />
            </span>
            JUMBLEYARD
          </span>
          <span className="party-badge">🏆 TOURNAMENT FINALE</span>
        </header>

        <main className="party-main">
          <div className="party-title-wrap">
            <h1 className="party-title" style={{ fontSize: 44 }}>
              👑 {champions.map((player) => player.name).join(' & ')}{' '}
              {champions.length > 1 ? 'Share the Win!' : 'Wins!'}
            </h1>
            <p className="party-subtitle">
              The 6-game gauntlet has finished! All hail the Party Champion!
            </p>
          </div>

          <div className="party-card">
            <PartyPodium players={room.players} playerId={playerId} />

            <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
              {isHost && (
                <button
                  type="button"
                  className="party-btn party-btn-primary"
                  onClick={handleRematch}
                >
                  <RotateCcw size={18} /> Play Rematch (New 6 Games)
                </button>
              )}
              <button
                type="button"
                className="party-btn party-btn-secondary"
                onClick={handleLeave}
              >
                <LogOut size={18} /> Exit to Collection
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 6. WAITING ROOM / LOBBY (Default)
  const slots: (PartyPlayer | null)[] = [null, null, null, null];
  room.players.forEach((p, i) => {
    if (i < 4) slots[i] = p;
  });

  return (
    <div className="party-root">
      <header className="party-header">
        <a className="party-brand" href="/">
          <span className="party-brand-icon">
            <Gamepad2 size={22} color="#294a43" />
          </span>
          JUMBLEYARD<span style={{ color: '#ca8038' }}>.</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            className="party-btn party-btn-ghost"
            style={{ padding: '8px 14px', fontSize: 13 }}
            onClick={handleLeave}
          >
            <LogOut size={15} /> Leave
          </button>
          <span className="party-badge">ROOM: {room.code}</span>
        </div>
      </header>

      <main className="party-main">
        <div className="party-title-wrap">
          <h1 className="party-title">Party Waiting Room</h1>
          <CastGuide
            pose={me?.ready ? 'cheer' : 'mail'}
            message={me?.ready ? 'partyReady' : 'partyWaiting'}
            className="party-cast-guide"
          />
          <p className="party-subtitle">
            Invite friends or add bots. Once 4 players are assembled, launch the
            tournament!
          </p>
        </div>

        <div className="party-card">
          {error && (
            <div
              style={{
                color: '#c0392b',
                fontWeight: 700,
                marginBottom: 20,
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}

          {/* Room Code & Invite Link Banner */}
          <div className="party-code-banner">
            <div className="party-code-meta">
              <span>Invite Code</span>
              <div className="party-code-val">{room.code}</div>
            </div>
            <button
              type="button"
              className="party-btn party-btn-secondary"
              onClick={handleCopyLink}
            >
              {copied ? (
                <Check size={18} color="#27ae60" />
              ) : (
                <Copy size={18} />
              )}
              {copied ? 'Invite Link Copied!' : 'Copy Invite Link'}
            </button>
          </div>

          {/* 4 Player Slots */}
          <div className="party-slots-grid">
            {slots.map((player, idx) => {
              if (player) {
                return (
                  <div key={player.id} className="party-slot-card occupied">
                    {isHost && player.id !== playerId && (
                      <button
                        type="button"
                        className="party-slot-kick"
                        onClick={() => handleKick(player.id)}
                        title="Remove player"
                      >
                        <X size={16} />
                      </button>
                    )}
                    <div
                      className="party-slot-avatar"
                      style={{
                        backgroundColor: COLORS[player.color] ?? '#999',
                      }}
                    >
                      {player.isHost && (
                        <span className="party-slot-crown" title="Party Host">
                          👑
                        </span>
                      )}
                      <Users size={28} />
                    </div>
                    <div className="party-slot-name">
                      {player.name} {player.id === playerId ? '(You)' : ''}
                    </div>
                    <span
                      className={`party-slot-badge ${player.ready ? 'ready' : 'waiting'}`}
                    >
                      {player.isBot
                        ? '🤖 Bot'
                        : player.ready
                          ? '✓ Ready'
                          : 'Waiting…'}
                    </span>
                  </div>
                );
              }

              return (
                <div key={`empty-${idx}`} className="party-slot-card empty">
                  <div style={{ color: '#999', marginBottom: 8 }}>
                    <Users size={32} opacity={0.4} />
                  </div>
                  <div style={{ fontWeight: 600, color: '#888', fontSize: 14 }}>
                    Player {idx + 1} Slot
                  </div>
                  {isHost && (
                    <button
                      type="button"
                      className="party-btn party-btn-ghost"
                      style={{
                        marginTop: 10,
                        fontSize: 13,
                        padding: '6px 12px',
                      }}
                      onClick={handleAddBot}
                    >
                      <Bot size={15} /> Add Bot
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 6-Game Playlist Preview */}
          <div className="party-playlist-preview">
            <div className="party-playlist-header">
              <span>Six rounds. Your party picks.</span>
              <span>Vote after each round</span>
            </div>
            <div className="party-games-row">
              {room.playlist.map((gameId, idx) => {
                const info = getPartyGameInfo(gameId);
                return (
                  <div key={`${gameId}-${idx}`} className="party-game-pill">
                    <span className="pill-round">GAME {idx + 1}</span>
                    <span>
                      {idx === 0
                        ? (info?.name ?? gameId)
                        : 'You decide by vote'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              className={`party-btn ${me?.ready ? 'party-btn-primary' : 'party-btn-secondary'}`}
              onClick={handleToggleReady}
            >
              {me?.ready ? '✓ You Are Ready' : 'Mark as Ready'}
            </button>

            {isHost ? (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  type="button"
                  className="party-btn party-btn-primary"
                  style={{ fontSize: 18, padding: '16px 32px' }}
                  onClick={handleStart}
                  disabled={room.players.length < 2}
                >
                  <Play size={20} /> Start Tournament
                </button>
              </div>
            ) : (
              <span style={{ color: '#71806b', fontWeight: 600 }}>
                Waiting for party leader to start…
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
