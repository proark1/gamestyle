'use client';
/* oxlint-disable react/react-compiler */

import { useEffect, useRef, useState } from 'react';
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
  nextPartyRound,
  rematchParty,
  leaveParty,
  closePartyRound,
} from '@/platform/party/client';
import type {
  PartyPass,
  PartyPlayer,
  PartyRoomState,
} from '@/platform/party/types';
import './party.css';
import { CastGuide } from '@/shared/clubhouse/Cast';

const SESSION_KEY = 'jumbleyard-party-session-v1';

export default function PartyClient({ initialCode }: { initialCode?: string }) {
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
  const [countdown, setCountdown] = useState<number | null>(null);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
            if (st) setRoom(st);
          });
        }
      }
    } catch {}
  }, []);

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

  // Polling loop to sync state across all 4 players
  useEffect(() => {
    if (!room?.code) return;

    const fetchState = async () => {
      try {
        const fresh = await getParty(room.code);
        if (fresh) {
          setRoom(fresh);
        }
      } catch {}
    };

    pollTimer.current = setInterval(fetchState, 1500);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [room?.code]);

  // This player has already reported their result for the round in play.
  const reported =
    !!playerId &&
    room?.status === 'countdown' &&
    room.reports?.[playerId] !== undefined;

  // Countdown handler
  useEffect(() => {
    if (room?.status !== 'countdown' || !room.countdownUntil || reported) {
      return;
    }
    const interval = setInterval(() => {
      const msLeft = (room.countdownUntil ?? 0) - Date.now();
      if (msLeft <= 0) {
        setCountdown(0);
        clearInterval(interval);
        // Navigate to current game
        const currentGame = room.playlist[room.currentRound];
        if (currentGame) {
          window.location.href = `/${currentGame}?party=${room.code}&round=${room.currentRound}`;
        }
      } else {
        setCountdown(Math.ceil(msLeft / 1000));
      }
    }, 200);

    return () => clearInterval(interval);
  }, [
    room?.status,
    room?.countdownUntil,
    room?.playlist,
    room?.currentRound,
    room?.code,
    reported,
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
      setRoom(res.state);
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
      setRoom(res.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join party.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = () => {
    if (!room) return;
    const url = `${window.location.origin}/party?room=${room.code}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleToggleReady = async () => {
    if (!room || !pass) return;
    try {
      const next = await togglePartyReady(room.code, pass, !me?.ready);
      setRoom(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle ready.');
    }
  };

  const handleAddBot = async () => {
    if (!room || !pass || !isHost) return;
    try {
      const next = await addPartyBot(room.code, pass);
      setRoom(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add bot.');
    }
  };

  const handleKick = async (targetId: string) => {
    if (!room || !pass || !isHost) return;
    try {
      const next = await removePartyPlayer(room.code, pass, targetId);
      setRoom(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove player.');
    }
  };

  const handleStart = async () => {
    if (!room || !pass || !isHost) return;
    try {
      const next = await startParty(room.code, pass);
      setRoom(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start party.');
    }
  };

  const handleNextRound = async () => {
    if (!room || !pass || !isHost) return;
    try {
      const next = await nextPartyRound(room.code, pass);
      setRoom(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not advance to next round.',
      );
    }
  };

  const handleCloseRound = async () => {
    if (!room || !pass || !isHost) return;
    try {
      const next = await closePartyRound(room.code, room.currentRound, pass);
      setRoom(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close round.');
    }
  };

  const handleRematch = async () => {
    if (!room || !pass || !isHost) return;
    try {
      const next = await rematchParty(room.code, pass);
      setRoom(next);
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
    setRoom(null);
    setPlayerId(null);
    setToken('');
  };

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
              Assemble 4 players, battle across 6 random mini-games, and crown
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

  // 4. INTERMISSION / STANDINGS VIEW
  if (room.status === 'intermission') {
    const lastResult = room.roundResults[room.roundResults.length - 1];
    const lastGameInfo = lastResult
      ? getPartyGameInfo(lastResult.game)
      : undefined;
    const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
    const nextGameId = room.playlist[room.currentRound + 1];
    const nextGameInfo = nextGameId ? getPartyGameInfo(nextGameId) : undefined;
    const nameOf = (id: string) =>
      room.players.find((p) => p.id === id)?.name ?? 'Someone';

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
            GAME {room.currentRound + 1} OF 6 COMPLETED
          </span>
        </header>

        <main className="party-main">
          <div className="party-title-wrap">
            <h1 className="party-title">Tournament Standings</h1>
            {lastGameInfo && (
              <p className="party-subtitle">
                {lastGameInfo.name} complete! Here is how the leaderboard
                stands:
              </p>
            )}
            {lastResult?.teams && (
              <p className="party-subtitle" style={{ fontSize: 15 }}>
                Teams this round: {lastResult.teams[0].map(nameOf).join(' & ')}{' '}
                vs {lastResult.teams[1].map(nameOf).join(' & ')}
              </p>
            )}
          </div>

          <div className="party-card">
            <table className="party-standings-table">
              <tbody>
                {sortedPlayers.map((player, idx) => {
                  const ptsWon = lastResult?.pointsAwarded[player.id] ?? 0;
                  return (
                    <tr key={player.id}>
                      <td style={{ width: 60 }}>
                        <span className={`party-rank-badge rank-${idx + 1}`}>
                          {idx + 1}
                        </span>
                      </td>
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
                      <td style={{ color: '#27ae60', fontWeight: 700 }}>
                        +{ptsWon} pts
                      </td>
                      <td className="party-score-cell">
                        {player.score}{' '}
                        <span style={{ fontSize: 14, color: '#888' }}>PTS</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {nextGameInfo && (
              <div className="party-playlist-preview">
                <div className="party-playlist-header">
                  <span>Up Next: Round {room.currentRound + 2} of 6</span>
                  <span>
                    {nextGameInfo.teams ? '2v2 Team Match' : 'Beat the Game'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ font: '700 20px Fredoka', color: '#294a43' }}>
                    {nextGameInfo.name}
                  </div>
                  <div style={{ color: '#6b805f', fontSize: 14 }}>
                    {nextGameInfo.tagline}
                  </div>
                </div>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 20,
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
                <button
                  type="button"
                  className="party-btn party-btn-primary"
                  onClick={handleNextRound}
                >
                  Launch Round {room.currentRound + 2} <ArrowRight size={18} />
                </button>
              ) : (
                <span style={{ color: '#71806b', fontWeight: 600 }}>
                  Waiting for party host to launch next round…
                </span>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 5. GRAND FINALE / WINNER PODIUM
  if (room.status === 'finished') {
    const podium = [...room.players].sort((a, b) => b.score - a.score);
    const champion = podium[0];

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
              👑 {champion?.name} Wins!
            </h1>
            <p className="party-subtitle">
              The 6-game gauntlet has finished! All hail the Party Champion!
            </p>
          </div>

          <div className="party-card">
            {/* 3D-styled Victory Podium */}
            <div className="party-podium">
              {/* 2nd Place */}
              {podium[1] && (
                <div className="party-podium-step step-2">
                  <div
                    className="party-podium-avatar"
                    style={{ backgroundColor: COLORS[podium[1].color] }}
                  >
                    🥈
                  </div>
                  <div style={{ fontSize: 15 }}>{podium[1].name}</div>
                  <div className="party-podium-label">
                    {podium[1].score} pts
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>2nd Place</div>
                </div>
              )}

              {/* 1st Place Champion */}
              {champion && (
                <div className="party-podium-step step-1">
                  <div
                    className="party-podium-avatar"
                    style={{
                      backgroundColor: COLORS[champion.color],
                      transform: 'scale(1.2)',
                    }}
                  >
                    👑
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>
                    {champion.name}
                  </div>
                  <div className="party-podium-label" style={{ fontSize: 28 }}>
                    {champion.score} pts
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    Champion!
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {podium[2] && (
                <div className="party-podium-step step-3">
                  <div
                    className="party-podium-avatar"
                    style={{ backgroundColor: COLORS[podium[2].color] }}
                  >
                    🥉
                  </div>
                  <div style={{ fontSize: 15 }}>{podium[2].name}</div>
                  <div className="party-podium-label">
                    {podium[2].score} pts
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>3rd Place</div>
                </div>
              )}
            </div>

            {/* 4th Place note if present */}
            {podium[3] && (
              <div
                style={{
                  textAlign: 'center',
                  color: '#777',
                  fontWeight: 600,
                  marginBottom: 30,
                }}
              >
                4th Place: {podium[3].name} ({podium[3].score} pts)
              </div>
            )}

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
              <span>Tournament Playlist (6 Random Games)</span>
              <span>{room.playlist.length} Games Selected</span>
            </div>
            <div className="party-games-row">
              {room.playlist.map((gameId, idx) => {
                const info = getPartyGameInfo(gameId);
                return (
                  <div key={`${gameId}-${idx}`} className="party-game-pill">
                    <span className="pill-round">GAME {idx + 1}</span>
                    <span>{info?.name ?? gameId}</span>
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
