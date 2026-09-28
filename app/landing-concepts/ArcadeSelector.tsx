'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { LandingGame } from './catalog';
import GameArtwork from './GameArtwork';

export default function ArcadeSelector({ games }: { games: LandingGame[] }) {
  const [activeIndex, setActiveIndex] = useState(1);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const active = games[activeIndex] ?? games[0];
  if (!active) return null;

  const move = (event: KeyboardEvent<HTMLButtonElement>, next: number) => {
    event.preventDefault();
    const normalized = (next + games.length) % games.length;
    setActiveIndex(normalized);
    buttons.current[normalized]?.focus();
  };

  return (
    <div className="arcade-selector">
      <fieldset className="arcade-cabinets">
        <legend>Choose a featured cabinet</legend>
        {games.map((game, index) => (
          <button
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            className="arcade-cabinet-choice"
            key={game.slug}
            aria-pressed={index === activeIndex}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => setActiveIndex(index)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') move(event, index + 1);
              if (event.key === 'ArrowLeft') move(event, index - 1);
              if (event.key === 'Home') move(event, 0);
              if (event.key === 'End') move(event, games.length - 1);
            }}
          >
            <span className="arcade-marquee">{game.title}</span>
            <GameArtwork src={game.image} alt="" title={game.title} eager />
            <span className="arcade-controls" aria-hidden="true">
              <i />
              <b />
              <b />
            </span>
          </button>
        ))}
      </fieldset>
      <div className="arcade-readout" aria-live="polite">
        <span>Player select · {String(activeIndex + 1).padStart(2, '0')}</span>
        <h3>{active.title}</h3>
        <p>{active.copy.desc}</p>
        <div>
          <span>{active.copy.players}</span>
          <span>{active.copy.duration}</span>
        </div>
        <a href={active.href}>
          {active.copy.cta} <ArrowUpRight size={17} />
        </a>
      </div>
    </div>
  );
}
