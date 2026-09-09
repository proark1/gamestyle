import type { Metadata, Viewport } from 'next';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import './globals.css';
import '../shared/styles/game-ui.css';
export const metadata: Metadata = {
  title: 'Jumbleyard — Bring your friends. Make a little chaos.',
  description:
    'Browser party games for your crew. Cook breakfast as one clumsy robot, catch giant fish, escape a flood, or build something together. Share a room code and make a little chaos.',
  icons: { icon: '/favicon.svg' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
