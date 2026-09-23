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
  icons: {
    icon: {
      url: '/images/brand/host-icon-32.png',
      sizes: '32x32',
      type: 'image/png',
    },
    apple: { url: '/images/brand/host-app-icon.png', type: 'image/png' },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Jumbleyard',
  },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1b718d',
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
