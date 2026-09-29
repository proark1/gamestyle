'use client';

import { MapPin } from 'lucide-react';
import type { EnhancedLandingCopy } from './copy';

const STOPS = [
  { id: 'clubhouse-title', key: 'welcome' },
  { id: 'enhanced-adventure', key: 'adventure' },
  { id: 'enhanced-party', key: 'party' },
  { id: 'games', key: 'games' },
] as const;

export default function YardPath({
  active,
  copy,
}: {
  active: string;
  copy: EnhancedLandingCopy;
}) {
  return (
    <nav className="yard-path" aria-label={copy.journey}>
      <span className="yard-path-title">
        <MapPin size={14} /> {copy.journey}
      </span>
      <ol>
        {STOPS.map((stop, index) => (
          <li key={stop.id}>
            <a
              href={`#${stop.id}`}
              aria-current={active === stop.id ? 'location' : undefined}
            >
              <i aria-hidden="true">{index + 1}</i>
              <span>{copy[stop.key]}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
