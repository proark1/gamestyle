import type { Metadata } from 'next';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import './globals.css';
export const metadata: Metadata = { title: 'Stack or Sink — A little teamwork. A lot of junk.', description: 'Build, climb, and survive the flood. A cooperative junk-stacking game for one to four players.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
