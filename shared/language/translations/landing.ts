import type { Localized } from '../types';

export interface LandingTranslation {
  headerNote: string;
  pickGame: string;
  kicker: string;
  heroTitleMain: string;
  heroTitleChaos: string;
  heroDesc: string;
  statGames: string;
  statPlayers: string;
  statMinutes: string;
  statNoAccount: string;
  shelfLeadTitle: string;
  shelfLeadSubtitle: string;
  footerNote: string;
  footerGuarantee: string;
}

export const LANDING_TRANSLATIONS: Localized<LandingTranslation> = {
  en: {
    headerNote: 'GOOD COMPANY. QUESTIONABLE PLANS.',
    pickGame: 'Pick a game',
    kicker: 'LITTLE GAMES. BIG FRIENDSHIP TESTS.',
    heroTitleMain: 'Bring your friends.',
    heroTitleChaos: 'Make a little chaos.',
    heroDesc:
      'Escape a flood. Fool a farmer. Carry a sofa. Build something together. More ways to find out who you can count on.',
    statGames: '{count} games',
    statPlayers: '1–4 players',
    statMinutes: '3–6 minute rounds',
    statNoAccount: 'No download, no account needed',
    shelfLeadTitle: 'The whole yard',
    shelfLeadSubtitle: 'Reshuffled every visit',
    footerNote: 'SAME LITTLE WORLD. DIFFERENT BAD IDEAS.',
    footerGuarantee: 'No download. Share a room code. You’re in.',
  },
  de: {
    headerNote: 'GUTE GESELLSCHAFT. FRAGWÜRDIGE PLÄNE.',
    pickGame: 'Spiel wählen',
    kicker: 'KLEINE SPIELE. GROSSE FREUNDSCHAFTSTESTS.',
    heroTitleMain: 'Bring deine Freunde mit.',
    heroTitleChaos: 'Stiftet ein wenig Chaos.',
    heroDesc:
      'Entkommt einer Flut. Täuscht einen Bauern. Tragt ein Sofa. Baut etwas zusammen. Mehr Wege herauszufinden, auf wen man zählen kann.',
    statGames: '{count} Spiele',
    statPlayers: '1–4 Spieler',
    statMinutes: '3–6 Minuten Runden',
    statNoAccount: 'Kein Download, kein Account nötig',
    shelfLeadTitle: 'Die ganze Spielwiese',
    shelfLeadSubtitle: 'Bei jedem Besuch neu gemischt',
    footerNote: 'DIESELBE KLEINE WELT. ANDERE SCHLECHTE IDEEN.',
    footerGuarantee: 'Kein Download. Raum-Code teilen. Drin.',
  },
};
