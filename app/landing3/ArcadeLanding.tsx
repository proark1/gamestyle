'use client';

import { ArrowDown, ArrowUpRight, Joystick, Power } from 'lucide-react';
import { useLanguage } from '@/shared/language/useLanguage';
import {
  FEATURED_GAMES,
  getLandingGames,
  selectGames,
} from '../landing-concepts/catalog';
import ArcadeSelector from '../landing-concepts/ArcadeSelector';
import { ARCADE_COPY } from '../landing-concepts/copy';
import LandingHeader from '../landing-concepts/LandingHeader';
import {
  GameCatalogue,
  LandingFooter,
  PartyCallout,
  ProductFacts,
} from '../landing-concepts/SharedSections';

export default function ArcadeLanding() {
  const { language, t } = useLanguage();
  const copy = t(ARCADE_COPY);
  const games = getLandingGames(language);
  const featured = selectGames(games, FEATURED_GAMES.arcade);

  return (
    <main className="alt-landing arcade-landing">
      <LandingHeader gamesLabel={copy.navGames} conceptLabel="Arcade cabinet" />

      <section className="arcade-hero" aria-labelledby="arcade-title">
        <div className="arcade-atmosphere" aria-hidden="true" />
        <div className="arcade-scanlines" aria-hidden="true" />
        <div className="arcade-hero-copy">
          <span className="arcade-kicker">
            <Power size={13} /> {copy.heroKicker}
          </span>
          <h1 id="arcade-title">
            {copy.heroTitle}
            <br />
            <em>{copy.heroAccent}</em>
          </h1>
          <p>{copy.heroLead}</p>
          <div className="arcade-actions">
            <a href="#featured-cabinets">
              {copy.primaryAction} <ArrowDown size={18} />
            </a>
            <a href="/party">
              {copy.partyAction} <ArrowUpRight size={18} />
            </a>
          </div>
          <ProductFacts copy={copy} />
        </div>
        <div className="arcade-insert" aria-hidden="true">
          <Joystick size={20} /> Press start
        </div>
      </section>

      <section
        className="arcade-featured"
        id="featured-cabinets"
        aria-labelledby="arcade-featured-title"
      >
        <div className="alt-section-heading">
          <span>{copy.featuredKicker}</span>
          <h2 id="arcade-featured-title">{copy.featuredTitle}</h2>
          <p>{copy.featuredLead}</p>
        </div>
        <ArcadeSelector games={featured} />
      </section>

      <GameCatalogue games={games} copy={copy} />
      <PartyCallout copy={copy} />
      <LandingFooter copy={copy} />
    </main>
  );
}
