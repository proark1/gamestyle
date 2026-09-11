/* eslint-disable next/no-html-link-for-pages -- Workshops open with a full page load. */
import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, CircleAlert, RefreshCw, X } from 'lucide-react';
import { SoundWorkshop } from '../../shared/audio/Admin';
import { AudioRequestProvider } from '../../shared/audio/AdminAccess';
import { ConstructionSoundWorkshop } from '../../shared/audio/construction/Admin';
import {
  isGameId as isConstructionGame,
  type Cue as ConstructionCue,
  type GameId as ConstructionGame,
} from '../../shared/audio/construction/types';
import { isGameId } from '../../shared/audio/types';
import { GAMES, type CatalogGame } from '../analytics/catalog';
import styles from './admin.module.css';

type Library = {
  keySaved: boolean;
  busy: boolean;
  settings: { voiceId: string };
  cues: {
    file: string | null;
    bundledUrl?: string;
    stale: boolean;
    error: string;
  }[];
};
type Status =
  | {
      total: number;
      ready: number;
      missing: number;
      outdated: number;
      failed: number;
      keySaved: boolean;
      voice: boolean;
      busy: boolean;
    }
  | { error: string };

/** Shelf Control plays the farm's clips, so only games with their own workshop get a card. */
const WORKSHOPS = GAMES.filter((game) => game.workshop.game === game.id);
const endpointOf = (game: CatalogGame) =>
  game.workshop.kind === 'construction'
    ? `/api/handwerker/audio/${game.id}`
    : `/api/audio/${game.id}`;

function summarize(game: CatalogGame, library: Library): Status {
  const construction = game.workshop.kind === 'construction';
  // The two workshops count "ready" the same way their own counters do.
  const ready = (cue: Library['cues'][number]) =>
    construction ? !!cue.file && !cue.stale : !!cue.file || !!cue.bundledUrl;
  return {
    total: library.cues.length,
    ready: library.cues.filter(ready).length,
    missing: library.cues.filter(
      (cue) => !cue.file && (construction || !cue.bundledUrl),
    ).length,
    outdated: library.cues.filter((cue) => cue.file && cue.stale).length,
    failed: library.cues.filter((cue) => cue.error).length,
    keySaved: library.keySaved,
    voice: !!library.settings.voiceId,
    busy: library.busy,
  };
}

export default function SoundPanel({
  credential,
  selected,
  onSelect,
  signOut,
}: {
  credential: string;
  selected: string | null;
  onSelect: (game: string | null) => void;
  signOut: () => void;
}) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    for (const game of WORKSHOPS)
      void fetch(endpointOf(game), {
        headers: { 'x-audio-admin': credential },
        cache: 'no-store',
        signal: controller.signal,
      })
        .then(async (response) => {
          if (response.status === 401) return signOut();
          const body = (await response.json()) as Library & { error?: string };
          setStatuses((previous) => ({
            ...previous,
            [game.id]: response.ok
              ? summarize(game, body)
              : { error: body.error || 'Unavailable' },
          }));
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setStatuses((previous) => ({
              ...previous,
              [game.id]: { error: 'Unavailable' },
            }));
        });
    return () => controller.abort();
  }, [credential, revision, signOut]);

  const active = WORKSHOPS.find((game) => game.id === selected);
  return (
    <div className={styles.panel}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <h2>Sound workshops</h2>
            <p className={styles.cardNote}>
              Every game&rsquo;s recordings, voices and volume in one place,
              with one sign-in. Shelf Control plays the Blend Business material
              sounds.
            </p>
          </div>
          <button
            type="button"
            className={styles.quiet}
            onClick={() => setRevision((value) => value + 1)}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <div className={styles.soundGrid}>
          {WORKSHOPS.map((game) => {
            const status = statuses[game.id];
            return (
              <button
                key={game.id}
                type="button"
                className={styles.soundCard}
                aria-pressed={selected === game.id}
                onClick={() => onSelect(selected === game.id ? null : game.id)}
              >
                <strong>{game.name}</strong>
                {!status ? (
                  <span className={styles.soundFacts}>Checking…</span>
                ) : 'error' in status ? (
                  <span className={styles.soundFacts}>
                    <CircleAlert size={13} aria-hidden="true" /> {status.error}
                  </span>
                ) : (
                  <>
                    <span className={styles.meter} aria-hidden="true">
                      <span
                        style={{
                          width: `${status.total ? (status.ready / status.total) * 100 : 0}%`,
                        }}
                      />
                    </span>
                    <span>
                      <strong>{status.ready}</strong> of {status.total} sounds
                      ready
                    </span>
                    <span className={styles.soundFacts}>
                      {status.missing > 0 && (
                        <span>{status.missing} missing</span>
                      )}
                      {status.outdated > 0 && (
                        <span>{status.outdated} outdated</span>
                      )}
                      {status.failed > 0 && <span>{status.failed} failed</span>}
                      {status.busy && <span>Generating</span>}
                      <span>
                        {status.keySaved ? (
                          <Check size={12} aria-hidden="true" />
                        ) : (
                          <X size={12} aria-hidden="true" />
                        )}{' '}
                        ElevenLabs key
                        <span className={styles.srOnly}>
                          {status.keySaved ? 'saved' : 'missing'}
                        </span>
                      </span>
                      <span>
                        {status.voice ? (
                          <Check size={12} aria-hidden="true" />
                        ) : (
                          <X size={12} aria-hidden="true" />
                        )}{' '}
                        Voice
                        <span className={styles.srOnly}>
                          {status.voice ? 'chosen' : 'not chosen'}
                        </span>
                      </span>
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>
      {active && (
        <section
          className={styles.workshopFrame}
          aria-label={`${active.name} sound workshop`}
        >
          <div className={styles.cardHead}>
            <h2>{active.name}</h2>
            <a
              className={styles.quiet}
              href={active.workshop.href}
              target="_blank"
              rel="noreferrer"
            >
              Open on its own page <ArrowUpRight size={14} />
            </a>
          </div>
          <AudioRequestProvider credential={credential}>
            {isConstructionGame(active.id) ? (
              <ConstructionWorkshop key={active.id} game={active.id} />
            ) : isGameId(active.id) ? (
              <SoundWorkshop key={active.id} game={active.id} embedded />
            ) : null}
          </AudioRequestProvider>
        </section>
      )}
    </div>
  );
}

function ConstructionWorkshop({ game }: { game: ConstructionGame }) {
  const [loaded, setLoaded] = useState<{
    game: ConstructionGame;
    catalog: ConstructionCue[];
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    // The building games' prompt catalogs are large; load one only when opened.
    const load =
      game === 'chaos'
        ? import('../../games/chaos/audio/catalog')
        : import('../../games/first-person/audio/catalog');
    void load.then((module) => {
      if (!cancelled) setLoaded({ game, catalog: module.getCatalog() });
    });
    return () => {
      cancelled = true;
    };
  }, [game]);
  return loaded?.game === game ? (
    <ConstructionSoundWorkshop game={game} catalog={loaded.catalog} embedded />
  ) : (
    <p className={styles.empty}>Loading the workshop…</p>
  );
}
