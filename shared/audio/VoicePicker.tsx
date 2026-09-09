'use client';
import { useAudioRequest } from './AdminAccess';

import { useEffect, useState } from 'react';
import type { VoiceOption } from './types';
import styles from './admin.module.css';

const labelNames: Record<string, string> = {
  language: 'Speech',
  accent: 'Accent',
  gender: 'Voice',
  age: 'Age',
  descriptive: 'Tone',
  description: 'Tone',
  use_case: 'Use case',
};
const NO_VOICES: VoiceOption[] = [];

export default function VoicePicker({
  endpoint,
  enabled,
  revision,
  value,
  onChange,
}: {
  endpoint: string;
  enabled: boolean;
  revision: number;
  value: string;
  onChange: (id: string) => void;
}) {
  const fetchAudio = useAudioRequest();
  const [result, setResult] = useState<{
    key: string;
    voices: VoiceOption[];
    error: string;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [failedPreview, setFailedPreview] = useState('');
  const requestKey = JSON.stringify([endpoint, enabled, revision, retry]);
  const voices =
    enabled && result?.key === requestKey ? result.voices : NO_VOICES;
  const error = result?.key === requestKey ? result.error : '';
  const loading = enabled && result?.key !== requestKey;
  useEffect(() => {
    const controller = new AbortController();
    if (enabled) {
      void fetchAudio(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ op: 'voices' }),
        cache: 'no-store',
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = (await response.json()) as {
            voices: VoiceOption[];
            error?: string;
          };
          if (!response.ok)
            throw new Error(data.error || 'Voices could not be loaded.');
          if (!controller.signal.aborted)
            setResult({
              key: requestKey,
              error: '',
              voices: data.voices.sort((a, b) =>
                a.name.localeCompare(b.name, 'en'),
              ),
            });
        })
        .catch((e) => {
          if (!controller.signal.aborted)
            setResult({
              key: requestKey,
              voices: [],
              error: e.message || 'Voices could not be loaded.',
            });
        });
    }
    return () => controller.abort();
  }, [endpoint, enabled, requestKey, fetchAudio]);

  const selected = voices.find((v) => v.id === value);
  const query = search.trim().toLocaleLowerCase();
  const matches = voices.filter((v) =>
    `${v.name} ${v.description} ${Object.values(v.labels).join(' ')}`
      .toLocaleLowerCase()
      .includes(query),
  );
  const options =
    selected && !matches.includes(selected) ? [selected, ...matches] : matches;
  return (
    <div className={styles.voicePicker}>
      <label htmlFor="voice-search">Search voices</label>
      <input
        id="voice-search"
        type="search"
        placeholder="Name, tone or accent …"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={!voices.length}
      />
      <label htmlFor="voice">Voice for this game</label>
      <select
        id="voice"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!enabled || loading || !voices.length}
        aria-describedby="voice-help"
      >
        <option value="">
          {loading ? 'Loading voices …' : 'Select a voice'}
        </option>
        {value && !selected && (
          <option value={value}>Custom / saved voice · {value}</option>
        )}
        {options.map((v) => (
          <option key={v.id} value={v.id}>
            {[v.name, v.labels.language, v.labels.accent]
              .filter(Boolean)
              .join(' · ')}
          </option>
        ))}
      </select>
      <p id="voice-help" className={styles.voiceHelp} aria-live="polite">
        {!enabled
          ? 'Save your ElevenLabs API key to load available voices.'
          : loading
            ? 'Loading available voices from ElevenLabs.'
            : error
              ? error
              : !voices.length
                ? 'No voices were found for this key.'
                : `${matches.length} voices found. Use “Save settings” to apply your selection.`}
      </p>
      {enabled && !loading && (error || !voices.length) && (
        <button type="button" onClick={() => setRetry((n) => n + 1)}>
          Reload voices
        </button>
      )}
      {selected && (
        <div className={styles.voiceCard}>
          <strong>{selected.name}</strong>
          <p>
            {selected.description ||
              'No description is available for this voice.'}
          </p>
          {Object.entries(selected.labels).length > 0 && (
            <dl className={styles.voiceLabels}>
              {Object.entries(selected.labels).map(([key, text]) => (
                <div key={key}>
                  <dt>{labelNames[key] || key}</dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          )}
          {selected.previewUrl ? (
            <>
              <label htmlFor="voice-preview">Listen to voice preview</label>
              {/* Provider sample has no supplied transcript. Native controls provide explicit play/pause. */}
              {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                id="voice-preview"
                key={selected.id}
                controls
                preload="none"
                aria-label={`Voice preview: ${selected.name}`}
                src={selected.previewUrl}
                onError={() => setFailedPreview(selected.id)}
                onCanPlay={() => setFailedPreview('')}
              />
              <p className={styles.voiceHelp}>
                Existing ElevenLabs sample, with no new generation. The sample
                may use another language; game speech is generated in English.
              </p>
              {failedPreview === selected.id && (
                <p role="alert">
                  This preview cannot be played right now. You can still select
                  the voice.
                </p>
              )}
            </>
          ) : (
            <p>ElevenLabs does not provide a preview for this voice.</p>
          )}
        </div>
      )}
      <details className={styles.voiceManual}>
        <summary>Advanced: enter a voice ID manually</summary>
        <label htmlFor="voice-id">ElevenLabs voice ID</label>
        <input
          id="voice-id"
          value={value}
          maxLength={100}
          spellCheck={false}
          placeholder="For custom or unlisted voices"
          onChange={(e) => onChange(e.target.value.trim())}
        />
      </details>
    </div>
  );
}
