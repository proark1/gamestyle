'use client';
import AdminAccess, { useAudioRequest } from './AdminAccess';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  AudioLines,
  Check,
  KeyRound,
  LoaderCircle,
  Music2,
  RefreshCw,
  Save,
  Search,
  Square,
  Volume2,
} from 'lucide-react';
import {
  DEFAULT_SETTINGS,
  GAME_NAMES,
  type AudioCategory,
  type AudioLibrary,
  type AudioSettings,
  type CueRecord,
  type GameId,
} from './types';
import styles from './admin.module.css';
import VoicePicker from './VoicePicker';
import NarratorDesigner from './NarratorDesigner';
import SavedSound from './SavedSound';
import { promptLimit } from './limits';

const categories: { id: AudioCategory | 'all'; name: string }[] = [
  { id: 'all', name: 'All sounds' },
  { id: 'material', name: 'Materials' },
  { id: 'speech', name: 'Speech' },
  { id: 'ambience', name: 'Ambience' },
  { id: 'music', name: 'Music' },
  { id: 'event', name: 'Actions' },
];
export function SoundWorkshop({
  game,
  embedded = false,
}: {
  game: GameId;
  /** Inside the admin page, which supplies sign-in and navigation. */
  embedded?: boolean;
}) {
  const fetchAudio = useAudioRequest();
  const [data, setData] = useState<AudioLibrary | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [key, setKey] = useState(''),
    [settings, setSettings] = useState<AudioSettings>(DEFAULT_SETTINGS),
    [voiceRevision, setVoiceRevision] = useState(0);
  const [busy, setBusy] = useState(''),
    [category, setCategory] = useState<AudioCategory | 'all'>('all'),
    [search, setSearch] = useState(''),
    [selection, setSelection] = useState('');
  const [drafts, setDrafts] = useState<Record<string, CueRecord>>({});
  const [generating, setGenerating] = useState(false),
    [cancelling, setCancelling] = useState(false);
  const [reuseSource, setReuseSource] = useState<GameId>(
    game === 'stack-or-sink' ? 'act-natural' : 'stack-or-sink',
  );
  const currentRequest = useRef<string | null>(null);
  const stopped = useRef(false),
    mounted = useRef(true),
    active = useRef(false);
  const endpoint = `/api/audio/${game}`;
  async function api(body?: unknown) {
    const response = await fetchAudio(endpoint, {
      ...(body
        ? {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          }
        : {}),
      cache: 'no-store',
    });
    const value = (await response.json()) as AudioLibrary & {
      error?: string;
      message?: string;
    };
    if (!response.ok)
      throw new Error(value.error || 'The audio connection is unavailable.');
    return value;
  }
  async function refresh(resetSettings = false) {
    const value = (await api()) as AudioLibrary;
    if (mounted.current) {
      setData(value);
      if (resetSettings) setSettings(value.settings);
      setSelection((old) => old || value.cues[0]?.id || '');
    }
    return value;
  }
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void fetchAudio(endpoint, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const value = (await response.json()) as AudioLibrary & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(
            value.error || 'The audio connection is unavailable.',
          );
        if (!controller.signal.aborted) {
          setData(value);
          setSettings(value.settings);
          setSelection(value.cues[0]?.id || '');
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => {
      mounted.current = false;
      stopped.current = true;
      controller.abort();
    };
  }, [endpoint, fetchAudio]);
  async function run(label: string, action: () => Promise<void>) {
    if (active.current) return;
    active.current = true;
    setBusy(label);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : 'The action failed.');
    } finally {
      active.current = false;
      if (mounted.current) setBusy('');
    }
  }
  const shown =
    data?.cues.filter(
      (c) =>
        (category === 'all' || c.category === category) &&
        `${c.name} ${c.group}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  const saved = data?.cues.find((c) => c.id === selection),
    selected = saved ? (drafts[selection] ?? saved) : undefined;
  const ready = data?.cues.filter((c) => c.file || c.bundledUrl).length ?? 0;
  const missing = shown.filter((c) => !c.file && !c.bundledUrl);
  const outdated = shown.filter((c) => c.file && c.stale);
  async function stopGeneration() {
    stopped.current = true;
    setCancelling(true);
    setMessage('Stopping generation. Remaining sounds will not start.');
    try {
      if (currentRequest.current)
        await api({ op: 'cancel', requestId: currentRequest.current });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not cancel the active sound. The remaining queue is stopped.',
      );
      setCancelling(false);
    }
  }
  function change(patch: Partial<CueRecord>) {
    if (selected && !busy)
      setDrafts((d) => ({ ...d, [selection]: { ...selected, ...patch } }));
  }
  async function saveCue(cue: CueRecord) {
    await api({ op: 'cue', cueId: cue.id, config: cue });
    setDrafts((old) => {
      const next = { ...old };
      delete next[cue.id];
      return next;
    });
  }
  async function saveVolume(cue: CueRecord) {
    await api({ op: 'volume', cueId: cue.id, volume: cue.volume });
    const value = await refresh();
    const persisted = value.cues.find((c) => c.id === cue.id);
    setDrafts((old) => {
      const draft = old[cue.id];
      if (!draft || !persisted) return old;
      const next = { ...old };
      // Keep unsaved prompt/duration edits when only volume is saved.
      if (
        ['prompt', 'text', 'duration', 'loop'].every(
          (field) =>
            draft[field as keyof CueRecord] ===
            persisted[field as keyof CueRecord],
        )
      )
        delete next[cue.id];
      return next;
    });
    setMessage(
      `${cue.name}: in-game volume saved at ${Math.round(cue.volume * 100)}%. No regeneration needed.`,
    );
  }
  async function generate(cues: CueRecord[]) {
    if (!data?.keyAvailable)
      throw new Error('Save your ElevenLabs API key first.');
    if (cues.some((c) => c.category === 'speech') && !data.settings.voiceId)
      throw new Error('Select and save a voice before generating speech.');
    for (const savedCue of cues) {
      const cue = drafts[savedCue.id] ?? savedCue;
      if (cue.prompt.length > promptLimit(cue.category)) {
        setSelection(cue.id);
        throw new Error(
          `${cue.name}: prompt is ${cue.prompt.length} characters; maximum ${promptLimit(cue.category)}. Shorten it before starting the batch. No sounds were generated.`,
        );
      }
    }
    stopped.current = false;
    setGenerating(true);
    setCancelling(false);
    let completed = 0;
    try {
      for (const cue of cues) {
        if (stopped.current) break;
        setBusy(`${completed + 1} / ${cues.length} · ${cue.name}`);
        if (drafts[cue.id]) await saveCue(drafts[cue.id]);
        if (stopped.current) break;
        currentRequest.current = crypto.randomUUID();
        try {
          await api({
            op: 'generate',
            cueId: cue.id,
            requestId: currentRequest.current,
          });
        } catch (e) {
          if (
            stopped.current &&
            e instanceof Error &&
            e.message === 'Generation cancelled.'
          )
            break;
          setSelection(cue.id);
          setMessage(
            `${completed} sound${completed === 1 ? '' : 's'} saved in this batch. Batch stopped at ${cue.name}. Use Generate missing or Regenerate outdated to continue; completed sounds are skipped.`,
          );
          throw new Error(
            `${cue.name}: ${e instanceof Error ? e.message : 'Generation failed.'}`,
          );
        } finally {
          currentRequest.current = null;
        }
        completed++;
        await refresh();
      }
      if (mounted.current)
        setMessage(
          `${completed} sound${completed === 1 ? '' : 's'} saved.${stopped.current ? ' Generation stopped. Remaining sounds were not generated.' : ' Available in the game.'}`,
        );
    } finally {
      if (mounted.current) {
        setGenerating(false);
        setCancelling(false);
        await refresh();
      }
    }
  }
  const Root = embedded ? 'section' : 'main';
  const Heading = embedded ? 'h2' : 'h1';
  return (
    <Root
      className={styles.page}
      data-game={game}
      data-embedded={embedded || undefined}
    >
      {!embedded && (
        <header className={styles.header}>
          <Link href={`/${game}`} className={styles.back}>
            <ArrowLeft size={18} /> Back to game
          </Link>
          <span className={styles.game}>{GAME_NAMES[game]}</span>
          <span className={styles.open}>Sound workshop</span>
        </header>
      )}
      <section className={styles.title}>
        <div>
          <p className={styles.eyebrow}>THE SOUND WORKSHOP</p>
          <Heading>Make every moment sound real.</Heading>
          <p>
            Every material. Every action. With realistic sounds from ElevenLabs.
          </p>
        </div>
        <div className={styles.counter}>
          <AudioLines size={26} />
          <strong>
            {ready}
            <small> / {data?.cues.length ?? '—'}</small>
          </strong>
          <span>Sounds ready</span>
        </div>
      </section>
      <section
        className={styles.setup}
        aria-label="ElevenLabs and audio settings"
      >
        <div className={styles.keyPanel}>
          <h2>
            <KeyRound size={18} /> Connect ElevenLabs
          </h2>
          <p>
            Enter and save your key. It stays encrypted on the server and is
            only shown as asterisks afterwards.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run('Save key', async () => {
                await api({ op: 'key', key });
                setKey('');
                await refresh();
                setMessage('Key saved securely.');
                setVoiceRevision((n) => n + 1);
              });
            }}
          >
            <label htmlFor="eleven-key">
              API key{' '}
              {data?.keySaved && (
                <span className={styles.saved}>
                  <Check size={13} /> saved
                </span>
              )}
            </label>
            <div className={styles.inputRow}>
              <input
                id="eleven-key"
                type="password"
                autoComplete="new-password"
                value={key}
                placeholder={data?.keySaved ? '********' : 'ElevenLabs API key'}
                onChange={(e) => setKey(e.target.value)}
                maxLength={256}
                spellCheck={false}
              />
              <button disabled={!key.trim() || !!busy || !data}>
                <Save size={16} /> Save
              </button>
            </div>
          </form>
          <div className={styles.smallActions}>
            <button
              disabled={!data?.keyAvailable || !!busy}
              onClick={() => setVoiceRevision((n) => n + 1)}
            >
              Check connection &amp; reload voices
            </button>
            <button
              disabled={!data?.keySaved || !!busy}
              onClick={() =>
                void run('Remove key', async () => {
                  await api({ op: 'delete-key' });
                  setKey('');
                  await refresh();
                  setMessage(
                    'Key removed. Previously generated sounds remain available.',
                  );
                })
              }
            >
              Remove key
            </button>
          </div>
          <p className={styles.notice}>
            Generation uses your ElevenLabs credits. Existing files stay
            available when a generation fails.
          </p>
        </div>
        <div className={styles.mixPanel}>
          <h2>
            <Volume2 size={18} /> Voices &amp; volume
          </h2>
          <VoicePicker
            endpoint={endpoint}
            enabled={!!data?.keyAvailable}
            revision={voiceRevision}
            value={settings.voiceId}
            onChange={(voiceId) => setSettings((s) => ({ ...s, voiceId }))}
          />
          <div className={styles.faders}>
            {(
              [
                ['effects', 'Sound effects'],
                ['speech', 'Speech'],
                ['ambience', 'Ambience'],
                ['music', 'Music'],
              ] as const
            ).map(([id, name]) => (
              <label key={id}>
                {name}
                <output>{Math.round(settings[id] * 100)}%</output>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step=".01"
                  value={settings[id]}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, [id]: Number(e.target.value) }))
                  }
                />
              </label>
            ))}
          </div>
          <button
            disabled={!!busy || !data}
            onClick={() =>
              void run('Save settings', async () => {
                await api({ op: 'settings', settings });
                await refresh();
                setMessage('Audio settings saved.');
              })
            }
          >
            <Save size={16} /> Save settings
          </button>
        </div>
      </section>
      <div className={styles.feedback} aria-live="polite">
        {busy ? (
          <p>
            <LoaderCircle className={styles.spin} size={17} /> {busy}{' '}
          </p>
        ) : null}
        {message && <p>{message}</p>}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
      {game === 'uphill-delivery' && (
        <section
          className={styles.reuse}
          aria-label="Reuse audio from other games"
        >
          <div>
            <h2>
              <Music2 size={18} /> Bring your collection’s sound along.
            </h2>
            <p>
              Reuse saved music, matching effects and compatible speech. Your
              existing sounds and edits stay in place. The collection narrator
              is already shared; delivery dialogue keeps its own words.
            </p>
            <small>Uses existing files. No generation credits needed.</small>
          </div>
          <div>
            <label htmlFor="reuse-audio-game">Source game</label>
            <select
              id="reuse-audio-game"
              value={reuseSource}
              disabled={!!busy}
              onChange={(e) => setReuseSource(e.target.value as GameId)}
            >
              <option value="stack-or-sink">Stack or Sink</option>
              <option value="act-natural">Blend Business</option>
            </select>
            <button
              disabled={!!busy || !data}
              onClick={() =>
                void run('Reuse saved audio', async () => {
                  const result = await api({
                    op: 'reuse',
                    sourceGame: reuseSource,
                  });
                  await refresh(true);
                  setVoiceRevision((n) => n + 1);
                  setMessage(result.message || 'Saved audio reused.');
                })
              }
            >
              Reuse missing sounds &amp; music
            </button>
          </div>
        </section>
      )}
      <NarratorDesigner
        endpoint={endpoint}
        enabled={!!data?.keyAvailable}
        busy={!!busy}
        run={run}
        onSelected={async (voiceId) => {
          setSettings((s) => ({ ...s, voiceId }));
          setVoiceRevision((n) => n + 1);
          await refresh();
        }}
        onSpeech={() => {
          setCategory('speech');
          setSearch('');
          setSelection(
            data?.cues.find((c) => c.category === 'speech')?.id || '',
          );
          document
            .getElementById('sound-library')
            ?.scrollIntoView({ block: 'start' });
        }}
      />
      <section
        id="sound-library"
        className={styles.library}
        aria-label="Sound library"
      >
        <div className={styles.toolbar}>
          <h2>
            <Music2 size={20} /> Sound library
          </h2>
          <button
            className={styles.quiet}
            disabled={!!busy}
            onClick={() =>
              void run('Load status', async () => {
                await refresh();
              })
            }
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            disabled={
              !!busy || !missing.length || !data?.keyAvailable || data.busy
            }
            onClick={() => void run('Start queue', () => generate(missing))}
          >
            Generate missing ({missing.length})
          </button>
          <button
            className={styles.quiet}
            disabled={
              !!busy || !outdated.length || !data?.keyAvailable || data.busy
            }
            onClick={() =>
              void run('Regenerate outdated sounds', () => generate(outdated))
            }
          >
            Regenerate outdated ({outdated.length})
          </button>
        </div>
        {generating && (
          <div className={styles.generationBar}>
            <output>
              <strong>
                {cancelling ? 'Stopping generation…' : 'Generating sounds'}
              </strong>
              <span>{busy}</span>
              <small>
                Completed sounds are kept. ElevenLabs may charge for a request
                already started.
              </small>
            </output>
            <button
              className={styles.stopButton}
              disabled={cancelling}
              onClick={() => void stopGeneration()}
            >
              <Square size={16} />{' '}
              {cancelling ? 'Stopping…' : 'Stop generation'}
            </button>
          </div>
        )}
        <p className={styles.queueHint}>
          Batches use the current filter. Generate missing fills empty sounds;
          Regenerate outdated replaces sounds whose prompts changed. Each sound
          is a separate ElevenLabs job. Keep this tab open; use Stop generation
          to cancel.
        </p>
        <nav className={styles.categories} aria-label="Sound categories">
          {categories.map((c) => (
            <button
              key={c.id}
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
              <span>
                {data?.cues.filter((v) => c.id === 'all' || v.category === c.id)
                  .length ?? 0}
              </span>
            </button>
          ))}
        </nav>
        <div className={styles.workspace}>
          <div className={styles.catalog}>
            <label className={styles.search}>
              <Search size={17} />
              <input
                aria-label="Search materials or sounds"
                placeholder="Search materials or sounds …"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className={styles.list}>
              {shown.map((c) => (
                <button
                  key={c.id}
                  className={styles.cue}
                  aria-pressed={selection === c.id}
                  onClick={() => setSelection(c.id)}
                >
                  <span className={styles.cueIcon}>
                    {c.category === 'music' ? (
                      <Music2 size={18} />
                    ) : (
                      <AudioLines size={18} />
                    )}
                  </span>
                  <span>
                    <strong>{c.name}</strong>
                    <small>
                      {c.error
                        ? 'Last attempt failed'
                        : c.stale
                          ? 'Prompt changed · regenerate'
                          : c.file || c.bundledUrl
                            ? 'Available in game'
                            : 'Not generated yet'}
                      {drafts[c.id] ? ' · unsaved' : ''}
                    </small>
                  </span>
                  <i data-ready={!!c.file || !!c.bundledUrl} />
                </button>
              ))}
              {!shown.length && (
                <p className={styles.empty}>
                  {data
                    ? 'No sounds match this filter.'
                    : 'Loading sound catalog …'}
                </p>
              )}
            </div>
          </div>
          <div className={styles.editor}>
            {selected ? (
              <>
                <p className={styles.eyebrow}>
                  {selected.group} /{' '}
                  {categories.find((c) => c.id === selected.category)?.name}
                </p>
                <h2>{selected.name}</h2>
                <SavedSound
                  game={game}
                  cue={selected}
                  savedVolume={saved!.volume}
                  disabled={!!busy}
                  onVolume={(volume) => change({ volume })}
                  onSave={() =>
                    void run('Save in-game volume', () => saveVolume(selected))
                  }
                />
                <p>
                  {selected.category === 'speech'
                    ? 'Voice direction uses Eleven v3 audio tags. The English speech text is entered separately below.'
                    : selected.category === 'music'
                      ? 'Instrumental background music. Describe the mood, instruments, tempo and progression.'
                      : 'The prompt describes the material, action, weight and sound. You can edit it before generating.'}
                </p>
                <label htmlFor="prompt">
                  {selected.category === 'speech'
                    ? 'Voice direction / AI prompt'
                    : 'AI prompt'}
                </label>
                <textarea
                  id="prompt"
                  value={selected.prompt}
                  maxLength={promptLimit(selected.category)}
                  aria-describedby="prompt-length"
                  aria-invalid={
                    selected.prompt.length > promptLimit(selected.category)
                  }
                  rows={selected.category === 'speech' ? 2 : 6}
                  onChange={(e) => change({ prompt: e.target.value })}
                />
                <small id="prompt-length">
                  {selected.prompt.length} / {promptLimit(selected.category)}{' '}
                  characters
                  {selected.prompt.length > promptLimit(selected.category)
                    ? ' — shorten this prompt before generating.'
                    : ''}
                </small>
                {selected.category === 'speech' && (
                  <>
                    <small>
                      For example [playfully], [excited] or [shouting]. Avoid
                      full instructions: they would be spoken aloud.
                    </small>
                    <label htmlFor="spoken-text">Speech text</label>
                    <textarea
                      id="spoken-text"
                      value={selected.text}
                      maxLength={1000}
                      rows={3}
                      onChange={(e) => change({ text: e.target.value })}
                    />
                  </>
                )}
                <div className={styles.parameters}>
                  {selected.category !== 'speech' && (
                    <label>
                      Duration in seconds
                      <input
                        type="number"
                        min={selected.category === 'music' ? 3 : 0.5}
                        max={selected.category === 'music' ? 120 : 30}
                        step=".5"
                        value={selected.duration}
                        onChange={(e) =>
                          change({ duration: Number(e.target.value) })
                        }
                      />
                    </label>
                  )}
                  {(selected.category === 'music' ||
                    selected.category === 'ambience') && (
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={selected.loop}
                        onChange={(e) => change({ loop: e.target.checked })}
                      />{' '}
                      Play as a loop
                    </label>
                  )}
                </div>
                <div className={styles.editorActions}>
                  <button
                    disabled={!!busy}
                    onClick={() =>
                      void run('Save prompt', async () => {
                        await saveCue(selected);
                        await refresh();
                        setMessage('Prompt and sound settings saved.');
                      })
                    }
                  >
                    <Save size={16} /> Save sound settings
                  </button>
                  <button
                    disabled={!!busy || !data?.keyAvailable || data.busy}
                    onClick={() =>
                      void run('Generate sound', () => generate([selected]))
                    }
                  >
                    <AudioLines size={17} />{' '}
                    {selected.file
                      ? 'Regenerate'
                      : selected.bundledUrl
                        ? 'Generate replacement'
                        : 'Generate sound'}
                  </button>
                  {drafts[selection] && (
                    <button
                      className={styles.quiet}
                      disabled={!!busy}
                      onClick={() =>
                        setDrafts((d) => {
                          const next = { ...d };
                          delete next[selection];
                          return next;
                        })
                      }
                    >
                      Discard changes
                    </button>
                  )}
                </div>
                {selected.error && (
                  <p className={styles.error}>{selected.error}</p>
                )}
              </>
            ) : (
              <p className={styles.empty}>Select a sound from the library.</p>
            )}
          </div>
        </div>
      </section>
    </Root>
  );
}

export default function AudioAdmin(props: { game: GameId }) {
  return (
    <AdminAccess endpoint={`/api/audio/${props.game}`}>
      <SoundWorkshop {...props} />
    </AdminAccess>
  );
}
