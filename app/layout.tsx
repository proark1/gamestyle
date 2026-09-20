import type { Metadata, Viewport } from 'next';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import './globals.css';
import '../shared/styles/game-ui.css';
import NativeProvider from '@/shared/browser/NativeProvider';
import PartyRibbon from '@/shared/ui/PartyRibbon';
import AdventureTracker from '@/shared/clubhouse/AdventureTracker';
import { CARDS_TRANSLATIONS } from '@/shared/language/translations/cards';
const adventureSlugs = Object.keys(CARDS_TRANSLATIONS);
export const metadata: Metadata = {
  title: 'Jumbleyard — Bring your friends. Make a little chaos.',
  description:
    'Browser party games for your crew. Cook breakfast as one clumsy robot, catch giant fish, escape a flood, or build something together. Share a room code and make a little chaos.',
  applicationName: 'Jumbleyard',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg', apple: '/favicon.svg' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Jumbleyard',
  },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#315e53',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <NativeProvider />
        <AdventureTracker slugs={adventureSlugs} />
        <PartyRibbon />
        {children}
      </body>
    </html>
  );
}
