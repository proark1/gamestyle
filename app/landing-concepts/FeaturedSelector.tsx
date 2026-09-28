'use client';

import { useState } from 'react';
import { ArrowUpRight, Radio, Timer, Users } from 'lucide-react';
import type { LandingGame } from './catalog';
import GameArtwork from './GameArtwork';

export default function FeaturedSelector({ games }: { games: LandingGame[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = games[activeIndex] ?? games[0];
  if (!active) return null;

  return (
    <div className="broadcast-selector">
      <div className="broadcast-feature" aria-live="polite">
        <div className="broadcast-feature-art">
          <GameArtwork
            key={active.slug}
            src={active.image}
            alt={active.alt}
            title={active.title}
            eager
          />
          <span className="broadcast-live">
            <Radio size={13} /> Live pick
          </span>
        </div>
        <div className="broadcast-feature-copy">
          <span>{active.copy.tag}</span>
          <h3>{active.title}</h3>
          <p>{active.copy.desc}</p>
          <div>
            <span>
              <Users size={15} /> {active.copy.players}
            </span>
            <span>
              <Timer size={15} /> {active.copy.duration}
            </span>
          </div>
          <a href={active.href}>
            {active.copy.cta} <ArrowUpRight size={17} />
          </a>
        </div>
      </div>
      <div className="broadcast-rundown" aria-label="Choose a featured game">
        {games.map((game, index) => (
          <button
            type="button"
            key={game.slug}
            aria-pressed={index === activeIndex}
            onClick={() => setActiveIndex(index)}
          >
            <span>0{index + 1}</span>
            <strong>{game.title}</strong>
            <small>{game.copy.players}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
