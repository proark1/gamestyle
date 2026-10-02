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
import { InteractiveCrew } from './InteractiveCrew';
import type { AccountSummary } from '../accounts/types';

export function ClubhouseWelcome({
  count,
  account,
}: {
  count: number;
  account: AccountSummary | null;
}) {
  const { t } = useLanguage();
  const copy = t(CLUBHOUSE_COPY);
  const facts = t(LANDING_TRANSLATIONS);
  return (
    <section className="clubhouse-hero" aria-labelledby="clubhouse-title">
      <div className="clubhouse-hero-copy">
        <p className="clubhouse-eyebrow">
          <span />
          {account ? copy.welcomeBack : copy.welcome}
        </p>
        <h1 id="clubhouse-title">
          {account?.displayName
            ? copy.heroPersonal.replace('{name}', account.displayName)
            : copy.heroTop}
          <br />
          <em>{copy.heroBottom}</em>
        </h1>
        <p className="clubhouse-intro">
          {account ? copy.introPersonal : copy.intro}
        </p>
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
        <p className="clubhouse-guest-note">
          {account ? copy.signedInNote : facts.statNoAccount}
        </p>
      </div>
      <InteractiveCrew />
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
  const poses = ['point', 'mail', 'wave'] as const;
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
      <Cast pose="wave" />
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
