'use client';

import { ArrowDown, ArrowUpRight, Radio, Volume2 } from 'lucide-react';
import { useLanguage } from '@/shared/language/useLanguage';
import {
  FEATURED_GAMES,
  getLandingGames,
  selectGames,
} from '../landing-concepts/catalog';
import { BROADCAST_COPY } from '../landing-concepts/copy';
import FeaturedSelector from '../landing-concepts/FeaturedSelector';
import GameArtwork from '../landing-concepts/GameArtwork';
import LandingHeader from '../landing-concepts/LandingHeader';
import {
  GameCatalogue,
  LandingFooter,
  PartyCallout,
  ProductFacts,
} from '../landing-concepts/SharedSections';

export default function BroadcastLanding() {
  const { language, t } = useLanguage();
  const copy = t(BROADCAST_COPY);
  const games = getLandingGames(language);
  const featured = selectGames(games, FEATURED_GAMES.broadcast);
  const heroGame = featured[0];

  return (
    <main className="alt-landing broadcast-landing">
      <LandingHeader
        gamesLabel={copy.navGames}
        conceptLabel="Party broadcast"
      />

      <section className="broadcast-hero" aria-labelledby="broadcast-title">
        <div className="broadcast-atmosphere" aria-hidden="true" />
        <div className="broadcast-hero-grid">
          <div className="broadcast-hero-copy">
            <span className="broadcast-kicker">
              <Radio size={13} /> {copy.heroKicker}
            </span>
            <h1 id="broadcast-title">
              {copy.heroTitle}
              <br />
              <em>{copy.heroAccent}</em>
            </h1>
            <p>{copy.heroLead}</p>
            <div className="broadcast-actions">
              <a href="#games">
                {copy.primaryAction} <ArrowDown size={18} />
              </a>
              <a href="/party">
                {copy.partyAction} <ArrowUpRight size={18} />
              </a>
            </div>
            <ProductFacts copy={copy} />
          </div>
          {heroGame ? (
            <a className="broadcast-hero-match" href={heroGame.href}>
              <GameArtwork
                src={heroGame.image}
                alt={heroGame.alt}
                title={heroGame.title}
                eager
              />
              <div>
                <span>Featured match</span>
                <strong>{heroGame.title}</strong>
                <small>
                  {heroGame.copy.players} · {heroGame.copy.duration}
                </small>
              </div>
            </a>
          ) : null}
        </div>
        <div className="broadcast-ticker" aria-hidden="true">
          <div>
            <span>
              <Volume2 size={14} /> 31 games live tonight
            </span>
            <span>No download · no account · no quiet plans</span>
            <span>Party mode is open</span>
            <span>
              <Volume2 size={14} /> 31 games live tonight
            </span>
            <span>No download · no account · no quiet plans</span>
            <span>Party mode is open</span>
          </div>
        </div>
      </section>

      <section
        className="broadcast-featured"
        aria-labelledby="broadcast-featured-title"
      >
        <div className="alt-section-heading">
          <span>{copy.featuredKicker}</span>
          <h2 id="broadcast-featured-title">{copy.featuredTitle}</h2>
          <p>{copy.featuredLead}</p>
        </div>
        <FeaturedSelector games={featured} />
      </section>

      <GameCatalogue games={games} copy={copy} />
      <PartyCallout copy={copy} />
      <LandingFooter copy={copy} />
    </main>
  );
}
