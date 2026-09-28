import { ArrowUpRight, Clock3, Gamepad2, Radio, Users } from 'lucide-react';
import type { LandingGame } from './catalog';
import type { ConceptCopy } from './copy';
import GameArtwork from './GameArtwork';

export function ProductFacts({ copy }: { copy: ConceptCopy }) {
  return (
    <ul className="alt-facts" aria-label="Jumbleyard facts">
      <li>
        <Gamepad2 size={16} /> {copy.gamesFact}
      </li>
      <li>
        <Users size={16} /> {copy.playersFact}
      </li>
      <li>
        <Clock3 size={16} /> {copy.roundsFact}
      </li>
    </ul>
  );
}

export function GameCatalogue({
  games,
  copy,
}: {
  games: LandingGame[];
  copy: ConceptCopy;
}) {
  return (
    <section
      className="alt-catalogue"
      id="games"
      aria-labelledby="catalogue-title"
    >
      <div className="alt-section-heading">
        <span>{copy.catalogueKicker}</span>
        <h2 id="catalogue-title">{copy.catalogueTitle}</h2>
        <p>{copy.catalogueLead}</p>
      </div>
      <div className="alt-game-grid">
        {games.map((game) => (
          <a className="alt-game-card" href={game.href} key={game.slug}>
            <div className="alt-game-art">
              <GameArtwork src={game.image} alt={game.alt} title={game.title} />
              {game.copy.isNew ? (
                <span className="alt-new-tag">{game.copy.newTag ?? 'New'}</span>
              ) : null}
            </div>
            <div className="alt-game-copy">
              <span>{game.copy.tag}</span>
              <h3>{game.title}</h3>
              <p>{game.copy.desc}</p>
              <div className="alt-game-meta">
                <span>{game.copy.players}</span>
                <span>{game.copy.duration}</span>
              </div>
              <strong>
                {game.copy.cta} <ArrowUpRight size={16} />
              </strong>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

export function PartyCallout({ copy }: { copy: ConceptCopy }) {
  return (
    <section className="alt-party" aria-labelledby="party-title">
      <div className="alt-party-signal" aria-hidden="true">
        <Radio size={31} />
        <span>1</span>
        <i />
        <span>2</span>
        <i />
        <span>3</span>
        <i />
        <span>4</span>
      </div>
      <div>
        <span>{copy.partyKicker}</span>
        <h2 id="party-title">{copy.partyTitle}</h2>
        <p>{copy.partyLead}</p>
      </div>
      <a href="/party">
        {copy.partyButton} <ArrowUpRight size={18} />
      </a>
    </section>
  );
}

export function LandingFooter({ copy }: { copy: ConceptCopy }) {
  return (
    <footer className="alt-footer">
      <span>{copy.footerNote}</span>
      <a href="/">
        {copy.backHome} <ArrowUpRight size={15} />
      </a>
    </footer>
  );
}
