'use client';
import { useState } from 'react';
import { Cast } from './Cast';
import { useLanguage } from '../language/useLanguage';
import { ADVENTURE_COPY } from './adventure-copy';
import { CLUBHOUSE_COPY } from './copy';
import './adventures.css';

const CREW = [
  { role: 'mail', pose: 'mail' },
  { role: 'point', pose: 'explorer' },
  { role: 'wave', pose: 'game-scout' },
] as const;
type CrewRole = (typeof CREW)[number]['role'];

export function InteractiveCrew() {
  const { t } = useLanguage();
  const copy = t(ADVENTURE_COPY);
  const [active, setActive] = useState<CrewRole | null>(null);
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
      {CREW.map(({ role, pose }) => (
        <button
          key={role}
          type="button"
          className={`hero-cast hero-cast-${role} crew-friend`}
          aria-label={copy.crewLabels[role]}
          aria-pressed={active === role}
          onClick={() => setActive(role)}
        >
          <Cast pose={pose} eager />
        </button>
      ))}
      <span className="clubhouse-crew-tag">{copy.tap}</span>
    </div>
  );
}
