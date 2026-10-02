import type { Game } from '../games/identity';

export default function LockedGame({ game }: { game: Game }) {
  const title = game
    .split('-')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: '#69cadd',
        color: '#17354a',
        fontFamily: 'var(--font-dm-sans, sans-serif)',
      }}
    >
      <section
        style={{
          width: 'min(520px, 100%)',
          padding: 'clamp(28px, 6vw, 52px)',
          border: '6px solid #17354a',
          borderRadius: '24px',
          background: '#f7f4e8',
          boxShadow: '10px 10px 0 #f26a3d',
        }}
      >
        <p style={{ margin: '0 0 12px', color: '#f26a3d', fontWeight: 800 }}>
          FULL GAME
        </p>
        <h1 style={{ margin: '0 0 14px', fontSize: 'clamp(36px, 8vw, 64px)' }}>
          {title} is locked
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: '18px', lineHeight: 1.5 }}>
          Sign in with an account that owns the full game, then open this course
          again.
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '13px 20px',
            borderRadius: '12px',
            background: '#17354a',
            color: '#fff',
            fontWeight: 800,
            textDecoration: 'none',
          }}
        >
          Back to the collection
        </a>
      </section>
    </main>
  );
}
