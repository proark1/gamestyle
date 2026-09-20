'use client';

import {
  ArrowDown,
  ArrowUpRight,
  Gamepad2,
  Trophy,
  Users,
  Timer,
} from 'lucide-react';
import { Cast } from './Cast';
import { CLUBHOUSE_COPY } from './copy';
import { useLanguage } from '../language/useLanguage';
import { LANDING_TRANSLATIONS } from '../language/translations/landing';

export function ClubhouseWelcome({ count }: { count: number }) {
  const { t } = useLanguage();
  const copy = t(CLUBHOUSE_COPY);
  const facts = t(LANDING_TRANSLATIONS);
  return (
    <section className="clubhouse-hero" aria-labelledby="clubhouse-title">
      <div className="clubhouse-hero-copy">
        <p className="clubhouse-eyebrow">
          <span />
          {copy.welcome}
        </p>
        <h1 id="clubhouse-title">
          {copy.heroTop}
          <br />
          <em>{copy.heroBottom}</em>
        </h1>
        <p className="clubhouse-intro">{copy.intro}</p>
        <div className="clubhouse-actions">
          <a className="clay-button" href="#games">
            <Gamepad2 size={20} />
            {copy.pick}
            <ArrowDown size={18} />
          </a>
          <a className="clay-button clay-button-light" href="/party">
            <Trophy size={19} />
            {copy.party}
          </a>
        </div>
        <p className="clubhouse-guest-note">{facts.statNoAccount}</p>
      </div>
      <div className="clubhouse-stage">
        <p className="cast-speech clubhouse-hero-speech">{copy.bubble}</p>
        <div className="clubhouse-sun" aria-hidden="true" />
        <div className="clubhouse-court" aria-hidden="true" />
        <Cast pose="mail" className="hero-cast hero-cast-mail" eager />
        <Cast pose="point" className="hero-cast hero-cast-point" eager />
        <Cast pose="wave" className="hero-cast hero-cast-wave" eager />
        <Cast pose="cheer" className="hero-cast hero-cast-cheer" eager />
        <span className="clubhouse-crew-tag">{copy.crew}</span>
      </div>
      <ul className="clubhouse-facts">
        <li>
          <Gamepad2 size={17} />
          {facts.statGames.replace('{count}', String(count))}
        </li>
        <li>
          <Users size={17} />
          {facts.statPlayers}
        </li>
        <li>
          <Timer size={17} />
          {facts.statMinutes}
        </li>
      </ul>
    </section>
  );
}

export function ClubhouseHowTo() {
  const { t } = useLanguage();
  const copy = t(CLUBHOUSE_COPY);
  const poses = ['point', 'mail', 'cheer'] as const;
  return (
    <section className="clubhouse-how" aria-labelledby="clubhouse-how-title">
      <h2 id="clubhouse-how-title">{copy.how}</h2>
      <ol className="clubhouse-steps">
        {copy.steps.map((step, index) => (
          <li key={step.title}>
            <Cast pose={poses[index]} />
            <div>
              <span className="clubhouse-step-number">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ClubhouseParty() {
  const { t } = useLanguage();
  const copy = t(CLUBHOUSE_COPY);
  return (
    <aside className="clubhouse-party">
      <Cast pose="cheer" />
      <div>
        <span className="clubhouse-eyebrow">
          <Trophy size={15} />
          PARTY MODE
        </span>
        <h2>{copy.partyTitle}</h2>
        <p>{copy.partyText}</p>
      </div>
      <a className="clay-button clay-button-light" href="/party">
        {copy.party}
        <ArrowUpRight size={18} />
      </a>
    </aside>
  );
}
