'use client';
/* oxlint-disable next/no-img-element -- Reuse pre-optimized overview artwork. */
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Gamepad2,
  Map,
  Shuffle,
  Sparkles,
  Stamp,
  Star,
  X,
} from 'lucide-react';
import { useLanguage } from '../language/useLanguage';
import {
  subscribeWardrobe,
  wardrobeSnapshot,
  serverWardrobeSnapshot,
} from '../wardrobe/wardrobe-state';
import { Cast } from './Cast';
import { ADVENTURE_COPY } from './adventure-copy';
import {
  acknowledgeAdventure,
  adventureSnapshot,
  pickAdventure,
  recordAdventureLook,
  serverAdventureSnapshot,
  subscribeAdventure,
} from './adventure-state';
import './adventures.css';
import type { AccountSummary } from '../accounts/types';

const WardrobeDialog = lazy(() => import('../wardrobe/WardrobeDialog'));
export type AdventureGame = {
  slug: string;
  href: string;
  title: string;
  image: string;
  players: string;
  cta: string;
};

export function AdventureDesk({
  games,
  account,
}: {
  games: AdventureGame[];
  account: AccountSummary | null;
}) {
  const { t } = useLanguage();
  const copy = t(ADVENTURE_COPY);
  const progress = useSyncExternalStore(
    subscribeAdventure,
    adventureSnapshot,
    serverAdventureSnapshot,
  );
  const wardrobe = useSyncExternalStore(
    subscribeWardrobe,
    wardrobeSnapshot,
    serverWardrobeSnapshot,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dressing, setDressing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const result = games.find((game) => game.slug === selected);
  const collected = games.filter((game) =>
    progress.visited.includes(game.slug),
  );
  const completed =
    Number(progress.styled) +
    Number(collected.length > 0) +
    Number(collected.length >= 3);
  const earned = progress.visited.length + Number(progress.styled);
  const celebrating = earned > progress.acknowledged;
  const hasOutfit = Object.keys(wardrobe.look).length > 0;

  useEffect(() => {
    if (hasOutfit) recordAdventureLook();
  }, [hasOutfit]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!celebrating) return;
    const timeout = setTimeout(acknowledgeAdventure, 6500);
    return () => clearTimeout(timeout);
  }, [celebrating, earned]);

  function shuffle() {
    if (timer.current || !games.length) return;
    const next = pickAdventure(
      games.map((game) => game.slug),
      progress.visited,
      selected,
    );
    if (!next) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSelected(next);
      return;
    }
    setRolling(true);
    timer.current = setTimeout(() => {
      setSelected(next);
      setRolling(false);
      timer.current = null;
    }, 650);
  }

  const quests = [
    {
      title: copy.style,
      hint: copy.styleHint,
      done: progress.styled,
      action: copy.dress,
      icon: Sparkles,
    },
    {
      title: copy.first,
      hint: copy.firstHint,
      done: collected.length > 0,
      action: copy.explore,
      icon: Gamepad2,
    },
    {
      title: copy.three,
      hint: copy.threeHint,
      done: collected.length >= 3,
      action: copy.explore,
      icon: Map,
    },
  ];
  return (
    <section className="adventure-desk" aria-label={copy.desk}>
      <div className={`adventure-picker ${rolling ? 'is-rolling' : ''}`}>
        <div className="adventure-picker-heading">
          <p className="clubhouse-eyebrow">{copy.pickLabel}</p>
          <h2>{account ? copy.pickPersonal : copy.pickTitle}</h2>
        </div>
        <div className="adventure-reveal" aria-busy={rolling}>
          {result ? (
            <div className="adventure-result" key={result.slug}>
              <img src={result.image} alt="" width={1024} height={683} />
              <span className="adventure-pick-tag">
                {progress.visited.includes(result.slug)
                  ? copy.revisit
                  : copy.newPick}
              </span>
              <div className="adventure-result-copy">
                <h3>{result.title}</h3>
                <p>{result.players}</p>
              </div>
            </div>
          ) : (
            <div className="adventure-mystery">
              <div className="adventure-die" aria-hidden="true">
                <Shuffle size={52} />
              </div>
              <Cast pose="point" />
              <p>{copy.pickHint}</p>
            </div>
          )}
        </div>
        <div className="adventure-picker-actions">
          {result && !rolling && (
            <a className="clay-button" href={result.href}>
              {result.cta}
              <ArrowUpRight size={18} />
            </a>
          )}
          <button
            className={`clay-button ${result ? 'clay-button-light' : ''}`}
            onClick={shuffle}
            disabled={rolling || !games.length}
            type="button"
          >
            <Shuffle size={18} />
            {rolling ? copy.shuffling : result ? copy.again : copy.shuffle}
          </button>
        </div>
        <output className="adventure-sr-only">
          {rolling
            ? copy.shuffling
            : result
              ? `${copy.revealed} ${result.title}`
              : ''}
        </output>
      </div>

      <div className="adventure-passport" id="passport">
        <div className="passport-heading">
          <div>
            <p className="clubhouse-eyebrow">{copy.passportLabel}</p>
            <h2>{copy.passport}</h2>
          </div>
          <Stamp size={32} aria-hidden="true" />
        </div>
        <p className="passport-note">
          {progress.persistent
            ? account
              ? copy.savedSignedIn
              : copy.saved
            : copy.temporary}
        </p>
        <div className="passport-progress">
          <strong>
            {collected.length}
            <span> / {games.length}</span>
          </strong>
          <span>{copy.stamps}</span>
        </div>
        <progress
          value={collected.length}
          max={games.length || 1}
          aria-label={copy.stamps}
        />
        <div className="passport-preview" aria-label={copy.stamps}>
          {collected.slice(-3).map((game) => (
            <a
              href={game.href}
              key={game.slug}
              className="passport-stamp"
              title={game.title}
            >
              <img src={game.image} alt="" width={100} height={100} />
              <span>{game.title}</span>
              <Check size={14} aria-hidden="true" />
            </a>
          ))}
          {Array.from(
            { length: Math.max(0, 3 - collected.length) },
            (_, index) => (
              <div
                className="passport-empty-stamp"
                key={index}
                aria-hidden="true"
              >
                <Star size={24} />
                <span>JY</span>
              </div>
            ),
          )}
        </div>
        {!collected.length && (
          <p className="passport-empty-hint">{copy.empty}</p>
        )}
        <button
          type="button"
          className="passport-toggle"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls="passport-collection"
        >
          {expanded ? copy.closeStamps : copy.allStamps}
          <ChevronDown size={17} />
        </button>
        <div
          className="passport-collection"
          id="passport-collection"
          hidden={!expanded}
        >
          {games.map((game) => {
            const visited = progress.visited.includes(game.slug);
            return (
              <a
                className={`passport-entry ${visited ? 'is-collected' : ''}`}
                key={game.slug}
                href={game.href}
              >
                {visited ? <Check size={17} /> : <Stamp size={17} />}
                <span>
                  {game.title}
                  <small>{visited ? copy.collected : copy.unvisited}</small>
                </span>
                <ArrowUpRight size={14} />
              </a>
            );
          })}
        </div>
        <div className="passport-quests">
          <h3>{copy.quests}</h3>
          <ul>
            {quests.map((quest, index) => (
              <li
                key={quest.title}
                className={quest.done ? 'quest-complete' : ''}
              >
                <span className="quest-icon">
                  {quest.done ? <Check size={18} /> : <quest.icon size={18} />}
                </span>
                <div>
                  <strong>{quest.title}</strong>
                  <p>{quest.hint}</p>
                </div>
                {quest.done ? (
                  <span className="quest-done">
                    <Check size={15} />
                    <span className="adventure-sr-only">{copy.complete}</span>
                  </span>
                ) : index === 0 ? (
                  <button
                    type="button"
                    onClick={() => setDressing(true)}
                    aria-label={quest.action}
                  >
                    <ArrowUpRight size={20} />
                  </button>
                ) : (
                  <a href="#games" aria-label={quest.action}>
                    <ArrowUpRight size={20} />
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="passport-footer">
            <Star size={16} fill={completed === 3 ? 'currentColor' : 'none'} />
            <span>
              <strong>
                {completed}/3 {copy.questProgress}.
              </strong>{' '}
              {completed === 3 ? copy.finished : copy.welcome}
            </span>
          </p>
        </div>
      </div>
      {celebrating && (
        <aside className="adventure-celebration" aria-live="polite">
          <Cast pose="wave" />
          <div>
            <strong>{copy.celebration}</strong>
            <p>{copy.celebrationHint}</p>
          </div>
          <button
            type="button"
            onClick={acknowledgeAdventure}
            aria-label={copy.dismiss}
          >
            <X size={18} />
          </button>
          <div className="adventure-confetti" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        </aside>
      )}
      {dressing && (
        <Suspense fallback={<output>…</output>}>
          <WardrobeDialog open onClose={() => setDressing(false)} />
        </Suspense>
      )}
    </section>
  );
}
