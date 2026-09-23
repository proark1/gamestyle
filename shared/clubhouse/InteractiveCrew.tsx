'use client';
import { useState } from 'react';
import { Cast, type CastPose } from './Cast';
import { useLanguage } from '../language/useLanguage';
import { ADVENTURE_COPY } from './adventure-copy';
import { CLUBHOUSE_COPY } from './copy';
import './adventures.css';

const POSES: CastPose[] = ['mail', 'point', 'wave'];
export function InteractiveCrew() {
  const { t } = useLanguage();
  const copy = t(ADVENTURE_COPY);
  const [active, setActive] = useState<CastPose | null>(null);
  return (
    <div className="clubhouse-stage interactive-crew">
      <p
        className="cast-speech clubhouse-hero-speech"
        aria-live="polite"
        aria-atomic="true"
      >
        {active ? copy.tips[active] : t(CLUBHOUSE_COPY).bubble}
      </p>
      <div className="clubhouse-sun" aria-hidden="true" />
      <div className="clubhouse-court" aria-hidden="true" />
      {POSES.map((pose) => (
        <button
          key={pose}
          type="button"
          className={`hero-cast hero-cast-${pose} crew-friend`}
          aria-label={copy.crewLabels[pose]}
          aria-pressed={active === pose}
          onClick={() => setActive(pose)}
        >
          <Cast pose={pose} eager />
        </button>
      ))}
      <span className="clubhouse-crew-tag">{copy.tap}</span>
    </div>
  );
}
