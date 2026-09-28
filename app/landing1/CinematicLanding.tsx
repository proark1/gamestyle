'use client';

import { ArrowDown, ArrowUpRight, Sparkles } from 'lucide-react';
import { useLanguage } from '@/shared/language/useLanguage';
import {
  FEATURED_GAMES,
  getLandingGames,
  selectGames,
} from '../landing-concepts/catalog';
import { CINEMATIC_COPY } from '../landing-concepts/copy';
import DioramaStage from '../landing-concepts/DioramaStage';
import GameArtwork from '../landing-concepts/GameArtwork';
import LandingHeader from '../landing-concepts/LandingHeader';
import {
  GameCatalogue,
  LandingFooter,
  PartyCallout,
  ProductFacts,
} from '../landing-concepts/SharedSections';

export default function CinematicLanding() {
  const { language, t } = useLanguage();
  const copy = t(CINEMATIC_COPY);
  const games = getLandingGames(language);
  const featured = selectGames(games, FEATURED_GAMES.cinematic);

  return (
    <main className="alt-landing cinematic-landing">
      <LandingHeader
        gamesLabel={copy.navGames}
        conceptLabel="Cinematic toybox"
      />

      <section className="cinematic-hero" aria-labelledby="cinematic-title">
        <DioramaStage>
          <div className="toybox-atmosphere" aria-hidden="true" />
          <div className="toybox-beam" aria-hidden="true" />
          <div className="cinematic-hero-copy">
            <span className="cinematic-kicker">
              <Sparkles size={14} /> {copy.heroKicker}
            </span>
            <h1 id="cinematic-title">
              {copy.heroTitle}
              <br />
              <em>{copy.heroAccent}</em>
            </h1>
            <p>{copy.heroLead}</p>
            <div className="cinematic-actions">
              <a href="#games">
                {copy.primaryAction} <ArrowDown size={18} />
              </a>
              <a href="/party">
                {copy.partyAction} <ArrowUpRight size={18} />
              </a>
            </div>
            <ProductFacts copy={copy} />
          </div>
          <div className="toybox-cast" aria-label="Featured Jumbleyard games">
            {featured.map((game, index) => (
              <a
                href={game.href}
                key={game.slug}
                className={`toybox-card toybox-card-${index + 1}`}
              >
                <GameArtwork
                  src={game.image}
                  alt={game.alt}
                  title={game.title}
                  eager
                />
                <span>{game.title}</span>
              </a>
            ))}
          </div>
          <span className="toybox-side-note" aria-hidden="true">
            One crew · questionable plans
          </span>
        </DioramaStage>
      </section>

      <section
        className="cinematic-featured"
        aria-labelledby="cinematic-featured-title"
      >
        <div className="alt-section-heading">
          <span>{copy.featuredKicker}</span>
          <h2 id="cinematic-featured-title">{copy.featuredTitle}</h2>
          <p>{copy.featuredLead}</p>
        </div>
        <div className="cinematic-scenes">
          {featured.map((game, index) => (
            <a href={game.href} key={game.slug} className="cinematic-scene">
              <GameArtwork src={game.image} alt={game.alt} title={game.title} />
              <div>
                <span>
                  Scene {String(index + 1).padStart(2, '0')} ·{' '}
                  {game.copy.players}
                </span>
                <h3>{game.title}</h3>
                <p>{game.copy.tagline}</p>
                <strong>
                  {game.copy.cta} <ArrowUpRight size={17} />
                </strong>
              </div>
            </a>
          ))}
        </div>
      </section>

      <GameCatalogue games={games} copy={copy} />
      <PartyCallout copy={copy} />
      <LandingFooter copy={copy} />
    </main>
  );
}
