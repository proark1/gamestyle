import './locked-game.css';

const DISPLAY_NAMES: Record<string, string> = {
  'act-natural': 'Blend Business',
  basketball: 'Court Clash',
  chaos: 'Permit Pending',
  'dont-wake-the-giant': 'Tiptoe Thieves',
  'first-person': 'Brick by Hand',
};

export default function LockedGame({ game }: { game: string }) {
  const name =
    DISPLAY_NAMES[game] ??
    game
      .replaceAll('-', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return (
    <main className="locked-game">
      <section
        className="locked-game-ticket"
        aria-labelledby="locked-game-title"
      >
        <span className="locked-game-eyebrow">Jumbleyard game entrance</span>
        <h1 id="locked-game-title">{name}</h1>
        <p>This game needs the full game pass for each player.</p>
        <p>
          Keep playing together in the free games while access is sorted out.
        </p>
        <a href="/party">Back to the party</a>
      </section>
    </main>
  );
}
