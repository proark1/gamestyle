'use client';
import { useAudioRequest } from './AdminAccess';

import { useEffect, useState } from 'react';
import { Mic2, RefreshCw } from 'lucide-react';
import { NARRATOR_DEFAULTS, type NarratorState } from './narrator-config';
import { GAME_NAMES } from './types';
import styles from './admin.module.css';

export default function NarratorDesigner({
  endpoint,
  enabled,
  busy,
  run,
  onSelected,
  onSpeech,
}: {
  endpoint: string;
  enabled: boolean;
  busy: boolean;
  run: (label: string, action: () => Promise<void>) => Promise<void>;
  onSelected: (id: string) => Promise<void>;
  onSpeech: () => void;
}) {
  const fetchAudio = useAudioRequest();
  const [state, setState] = useState<NarratorState | null>(null);
  const [config, setConfig] = useState(NARRATOR_DEFAULTS);
  const [text, setText] = useState(
    'Oh, magnificent. The entire plan is now underwater. Shall we call that a team-building exercise?',
  );
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function api(body: unknown) {
    const response = await fetchAudio(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const result = (await response.json()) as NarratorState & {
      error?: string;
    };
    if (!response.ok)
      throw new Error(result.error || 'The narrator could not be loaded.');
    return result;
  }
  useEffect(() => {
    const abort = new AbortController();
    void fetchAudio(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'narrator-get' }),
      cache: 'no-store',
      signal: abort.signal,
    })
      .then(async (response) => {
        const value = (await response.json()) as NarratorState & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(value.error || 'Could not load the narrator.');
        if (!abort.signal.aborted) {
          setState(value);
          setConfig(value.config);
        }
      })
      .catch((e: Error) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [endpoint, fetchAudio]);
  const locked = busy || !!state?.busy || !state;
  const valid =
    config.name.trim().length > 0 &&
    config.description.trim().length >= 20 &&
    config.text.trim().length >= 100;
  function action(label: string, body: unknown, message: string) {
    void run(label, async () => {
      setError('');
      setNotice('');
      const value = await api(body);
      setState(value);
      setNotice(message);
      if ((body as { op: string }).op === 'narrator-select' && value.voice)
        await onSelected(value.voice.id);
    });
  }
  return (
    <section className={styles.narrator} aria-labelledby="narrator-title">
      <div className={styles.narratorHeader}>
        <div>
          <p className={styles.eyebrow}>One voice · your game collection</p>
          <h2 id="narrator-title">
            <Mic2 size={22} /> Voice design
          </h2>
          <p>
            A cool head. Terrible advice. Impeccable timing. Create your shared
            chaos commentator here.
          </p>
        </div>
        <button
          className={styles.quiet}
          disabled={busy}
          onClick={() =>
            action(
              'Refresh narrator',
              { op: 'narrator-get' },
              'Narrator status refreshed. Your draft is kept.',
            )
          }
        >
          <RefreshCw size={16} /> Refresh status
        </button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {state?.busy && (
        <output>
          A narrator job is running. Refresh status when it finishes.
        </output>
      )}
      <div className={styles.narratorColumns}>
        <div>
          <h3>1. Describe the character</h3>
          <label htmlFor="narrator-name">Voice name</label>
          <input
            id="narrator-name"
            value={config.name}
            maxLength={80}
            disabled={busy}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
          />
          <label htmlFor="narrator-description">Voice design prompt</label>
          <textarea
            id="narrator-description"
            rows={7}
            value={config.description}
            maxLength={1000}
            disabled={busy}
            onChange={(e) =>
              setConfig({ ...config, description: e.target.value })
            }
          />
          <p className={styles.voiceHelp}>
            Describe the voice here. This description is never read aloud.
          </p>
          <label htmlFor="narrator-audition">Audition script</label>
          <textarea
            id="narrator-audition"
            rows={4}
            value={config.text}
            minLength={100}
            maxLength={1000}
            disabled={busy}
            onChange={(e) => setConfig({ ...config, text: e.target.value })}
          />
          <small>{config.text.length}/1000 characters · minimum 100</small>
          <div className={styles.editorActions}>
            <button
              disabled={locked || !valid}
              className={styles.quiet}
              onClick={() =>
                action(
                  'Save narrator prompt',
                  { op: 'narrator-save', config },
                  'Voice design prompt saved for the collection.',
                )
              }
            >
              Save prompt
            </button>
            <button
              disabled={locked || !enabled || !valid}
              onClick={() =>
                action(
                  'Generating voice auditions…',
                  { op: 'narrator-design', config },
                  'Auditions are ready. Listen and choose your narrator.',
                )
              }
            >
              Generate voice auditions
            </button>
          </div>
          <p className={styles.notice}>
            Auditions and spoken text use ElevenLabs credits. Saving a prompt
            and replaying audio do not generate audio.{' '}
            {!enabled && 'Save an API key above to begin.'}
          </p>
        </div>
        <div>
          <h3>2. Listen and choose</h3>
          {state?.audition ? (
            <>
              <p>
                Auditions for <strong>{state.audition.config.name}</strong>.
                These use the saved key in{' '}
                {GAME_NAMES[state.audition.sourceGame]}.
              </p>
              {state.audition.previews.map((p, index) => (
                <div key={p.id} className={styles.voiceCard}>
                  <strong>
                    Audition {index + 1}
                    {p.voiceId && p.voiceId === state.voice?.id
                      ? ' · selected'
                      : ''}
                  </strong>
                  {/* The full transcript is shown directly below the audition players. */}
                  {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio
                    controls
                    preload="none"
                    src={p.url}
                    aria-label={`Narrator audition ${index + 1}`}
                  />
                  <button
                    disabled={locked}
                    onClick={() =>
                      action(
                        'Saving the collection narrator…',
                        { op: 'narrator-select', previewId: p.id },
                        'Collection narrator selected. Generate speech below to update the gameplay lines.',
                      )
                    }
                  >
                    {p.voiceId && p.voiceId === state.voice?.id
                      ? 'Apply again to the collection'
                      : 'Use this voice for the collection'}
                  </button>
                </div>
              ))}
              <details className={styles.voiceManual}>
                <summary>Audition transcript and original prompt</summary>
                <p>{state.audition.config.text}</p>
                <p>{state.audition.config.description}</p>
              </details>
            </>
          ) : (
            <p>
              Generate auditions to hear different interpretations of the
              character, then pick your favorite.
            </p>
          )}
          <h3>3. Give the narrator a line</h3>
          <p>
            {state?.voice
              ? `Selected narrator: ${state.voice.name}. The collection can use the key saved in ${GAME_NAMES[state.voice.sourceGame]}.`
              : 'Choose an audition first. The same saved voice will be used across the collection.'}
          </p>
          <label htmlFor="narrator-spoken-text">Spoken text</label>
          <textarea
            id="narrator-spoken-text"
            rows={3}
            maxLength={1000}
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
          />
          <div className={styles.editorActions}>
            <button
              disabled={locked || !state?.voice || !enabled || !text.trim()}
              onClick={() =>
                action(
                  'Generating spoken text…',
                  { op: 'narrator-speak', text },
                  'Spoken text generated. You can listen or download it below.',
                )
              }
            >
              Generate spoken text
            </button>
            <button className={styles.quiet} onClick={onSpeech}>
              Edit gameplay dialogue
            </button>
          </div>
          {state?.sample && (
            <div className={styles.preview}>
              <span>
                Last generated line
                {state.sample.voiceId !== state.voice?.id
                  ? ' · previous voice'
                  : ''}
              </span>
              {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                controls
                preload="none"
                src={state.sample.url}
                aria-label="Generated spoken text"
              />
              <p>{state.sample.text}</p>
              <a href={state.sample.url} download="chaos-commentator.mp3">
                Download spoken text
              </a>
              <small>
                This is a standalone line. To use a line during play, edit and
                generate a speech cue in the sound library.
              </small>
            </div>
          )}
        </div>
      </div>
      {notice && <output>{notice}</output>}
    </section>
  );
}
