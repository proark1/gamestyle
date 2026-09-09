'use client';

import { useEffect, useRef } from 'react';
import { Save } from 'lucide-react';
import { audioFileUrl, type CueRecord, type GameId } from './types';
import styles from './admin.module.css';

export default function SavedSound({
  cue,
  savedVolume,
  disabled,
  onVolume,
  onSave,
}: {
  game: GameId;
  cue: CueRecord;
  savedVolume: number;
  disabled: boolean;
  onVolume: (volume: number) => void;
  onSave: () => void;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const url = cue.file ? audioFileUrl(cue.file) : cue.bundledUrl;
  useEffect(() => {
    if (audio.current) audio.current.volume = cue.volume;
  }, [cue.volume, cue.file]);
  return (
    <section
      className={styles.preview}
      aria-label="Saved sound and in-game volume"
    >
      <strong>
        {cue.file
          ? 'Listen to saved sound'
          : url
            ? 'Listen to included sound'
            : 'Sound preview'}
      </strong>
      {url ? (
        <>
          {/* Audio-only preview: the speech text or sound description is in the editor below. */}
          {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
          <audio
            ref={audio}
            key={url}
            aria-label={`Preview: ${cue.name}`}
            controls
            preload="none"
            src={url}
          />
          <small>
            {cue.generated
              ? new Date(cue.generated).toLocaleString('en-US')
              : ''}
            {cue.stale ? ' · previous prompt version' : ''}
          </small>
        </>
      ) : (
        <p>Once generated, your saved sound will be playable here.</p>
      )}
      <label className={styles.soundVolume}>
        In-game volume · {Math.round(cue.volume * 100)}%
        {cue.volume === 0 ? ' · muted' : ''}
        <input
          type="range"
          min="0"
          max="1"
          step=".01"
          value={cue.volume}
          disabled={disabled}
          onChange={(event) => onVolume(Number(event.target.value))}
        />
      </label>
      <div className={styles.editorActions}>
        <button
          disabled={disabled || cue.volume === savedVolume}
          onClick={onSave}
        >
          <Save size={16} /> Save volume
        </button>
        <small>
          {cue.volume !== savedVolume ? 'Volume not saved yet' : 'Volume saved'}
        </small>
      </div>
      <small>
        No regeneration needed. Saved changes reach open games within 30
        seconds. The game also applies its category volume.
      </small>
    </section>
  );
}
