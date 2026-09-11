'use client';
/* eslint-disable next/no-html-link-for-pages -- The collection opens with a full page load. */

import { useCallback, useState } from 'react';
import {
  AudioLines,
  Gamepad2,
  LayoutDashboard,
  ListTree,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { GAMES } from '../analytics/catalog';
import GamePanel from './GamePanel';
import OverviewPanel from './OverviewPanel';
import SessionsPanel, { type SessionFilter } from './SessionsPanel';
import SoundPanel from './SoundPanel';
import type { Scope } from './request';
import styles from './admin.module.css';

type Tab = 'overview' | 'games' | 'sessions' | 'sound';
const TABS = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'games', label: 'Games', Icon: Gamepad2 },
  { id: 'sessions', label: 'Sessions', Icon: ListTree },
  { id: 'sound', label: 'Sound', Icon: AudioLines },
] as const;
const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: '7', label: '7 days' },
  { id: '30', label: '30 days' },
  { id: '90', label: '90 days' },
  { id: 'all', label: 'All time' },
] as const;
type Period = (typeof PERIODS)[number]['id'];

function periodStart(period: Period) {
  if (period === 'all') return 0;
  if (period === 'today') {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return midnight.getTime();
  }
  return Date.now() - Number(period) * 86_400_000;
}

/** The single admin page: play statistics for every game and every sound workshop. */
export default function AdminHub() {
  const [credential, setCredential] = useState('');
  const signOut = useCallback(() => setCredential(''), []);
  return credential ? (
    <Dashboard credential={credential} signOut={signOut} />
  ) : (
    <SignIn onSignIn={setCredential} />
  );
}

function SignIn({ onSignIn }: { onSignIn: (credential: string) => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const encoded = encodeURIComponent(password);
      const response = await fetch('/api/admin/analytics?access', {
        headers: { 'x-audio-admin': encoded },
        cache: 'no-store',
      });
      if (!response.ok)
        throw new Error('The admin page is unavailable. Try again shortly.');
      const access = (await response.json()) as {
        configured: boolean;
        authorized: boolean;
      };
      if (!access.configured)
        throw new Error(
          'Administrator access is not configured on the server (AUDIO_ADMIN_PASSWORD).',
        );
      if (!access.authorized)
        throw new Error('The administrator password is incorrect.');
      setPassword('');
      onSignIn(encoded);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={`${styles.hub} ${styles.signIn}`}>
      <form className={styles.signInCard} onSubmit={submit}>
        <p className={styles.eyebrow}>Jumbleyard admin</p>
        <h1>Every game, every session.</h1>
        <p>
          How each game is played, where players get stuck, and all the sound
          workshops. Sign in with the sound workshop administrator password.
        </p>
        <label htmlFor="admin-password">Administrator password</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          maxLength={256}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button className={styles.primary} disabled={busy || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <a className={styles.quietLink} href="/">
          Back to all games
        </a>
      </form>
    </main>
  );
}

function Dashboard({
  credential,
  signOut,
}: {
  credential: string;
  signOut: () => void;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<Period>('30');
  const [from, setFrom] = useState(() => periodStart('30'));
  const [revision, setRevision] = useState(0);
  const [tz] = useState(() => new Date().getTimezoneOffset());
  const [game, setGame] = useState('');
  const [filter, setFilter] = useState<SessionFilter>({});
  const [soundGame, setSoundGame] = useState<string | null>(null);
  const scope: Scope = { credential, from, tz, revision, signOut };

  const choosePeriod = (next: Period) => {
    setPeriod(next);
    setFrom(periodStart(next));
  };
  const chooseGame = (next: string) => {
    setGame(next);
    setFilter((current) => ({ ...current, step: undefined }));
  };
  const openSessions = (next: SessionFilter) => {
    if (next.game !== undefined) setGame(next.game);
    setFilter({ step: next.step });
    setTab('sessions');
  };

  return (
    <div className={styles.hub}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <a className={styles.brand} href="/">
            <span>
              <Gamepad2 size={20} aria-hidden="true" />
            </span>
            JUMBLEYARD
            <small>ADMIN</small>
          </a>
          <nav className={styles.tabs} aria-label="Admin sections">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => setTab(id)}
              >
                <Icon size={16} aria-hidden="true" /> {label}
              </button>
            ))}
          </nav>
          <button type="button" className={styles.quiet} onClick={signOut}>
            <LogOut size={14} aria-hidden="true" /> Sign out
          </button>
        </header>
        {tab !== 'sound' && (
          <div className={styles.filters}>
            <fieldset className={styles.segmented}>
              <legend className={styles.srOnly}>Period</legend>
              {PERIODS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={period === option.id}
                  onClick={() => choosePeriod(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </fieldset>
            <label>
              <span className={styles.srOnly}>Game</span>
              <select
                className={styles.select}
                value={game}
                onChange={(event) => chooseGame(event.target.value)}
              >
                <option value="">All games</option>
                {GAMES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={styles.quiet}
              onClick={() => {
                setFrom(periodStart(period));
                setRevision((value) => value + 1);
              }}
            >
              <RefreshCw size={14} aria-hidden="true" /> Refresh
            </button>
          </div>
        )}
        <main className={styles.content}>
          {tab === 'overview' && (
            <OverviewPanel
              scope={scope}
              onGame={(id) => {
                chooseGame(id);
                setTab('games');
              }}
            />
          )}
          {tab === 'games' && (
            <GamePanel
              scope={scope}
              game={game}
              onGame={chooseGame}
              onSessions={openSessions}
              onSound={(id) => {
                setSoundGame(id);
                setTab('sound');
              }}
            />
          )}
          {tab === 'sessions' && (
            <SessionsPanel
              scope={scope}
              filter={{ ...filter, game: game || undefined }}
              onFilter={({ game: _game, ...rest }) => setFilter(rest)}
            />
          )}
          {tab === 'sound' && (
            <SoundPanel
              credential={credential}
              selected={soundGame}
              onSelect={setSoundGame}
              signOut={signOut}
            />
          )}
        </main>
      </div>
    </div>
  );
}
