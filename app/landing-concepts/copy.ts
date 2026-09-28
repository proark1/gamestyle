import type { Localized } from '@/shared/language/types';

export interface ConceptCopy {
  navGames: string;
  heroKicker: string;
  heroTitle: string;
  heroAccent: string;
  heroLead: string;
  primaryAction: string;
  partyAction: string;
  gamesFact: string;
  playersFact: string;
  roundsFact: string;
  featuredKicker: string;
  featuredTitle: string;
  featuredLead: string;
  catalogueKicker: string;
  catalogueTitle: string;
  catalogueLead: string;
  partyKicker: string;
  partyTitle: string;
  partyLead: string;
  partyButton: string;
  footerNote: string;
  backHome: string;
}

export const CINEMATIC_COPY: Localized<ConceptCopy> = {
  en: {
    navGames: 'Enter the toybox',
    heroKicker: 'The yard is open',
    heroTitle: 'Chaos looks',
    heroAccent: 'good on you.',
    heroLead:
      'Thirty-one tiny worlds. One crew. Pick a bad idea and make it memorable.',
    primaryAction: 'Pick a game',
    partyAction: 'Start party mode',
    gamesFact: '31 games',
    playersFact: '1–4 players',
    roundsFact: 'No download',
    featuredKicker: 'Tonight on the little stage',
    featuredTitle: 'Three beautifully bad ideas.',
    featuredLead:
      'Handmade worlds, oversized problems, and just enough room for your whole crew.',
    catalogueKicker: 'The prop room',
    catalogueTitle: 'Every game in the yard.',
    catalogueLead: 'Open a door. The chaos is already set up inside.',
    partyKicker: 'One room code',
    partyTitle: 'Turn game night into a whole season.',
    partyLead:
      'Gather your crew, rotate through mini-games, and keep the crown moving until somebody demands a rematch.',
    partyButton: 'Play party mode',
    footerNote: 'Good company. Questionable plans.',
    backHome: 'Visit the original yard',
  },
  de: {
    navGames: 'In die Spielkiste',
    heroKicker: 'Der Yard ist offen',
    heroTitle: 'Chaos steht',
    heroAccent: 'euch ziemlich gut.',
    heroLead:
      'Einunddreißig kleine Welten. Eine Crew. Wählt eine schlechte Idee und macht sie unvergesslich.',
    primaryAction: 'Spiel wählen',
    partyAction: 'Party-Modus starten',
    gamesFact: '31 Spiele',
    playersFact: '1–4 Spieler',
    roundsFact: 'Kein Download',
    featuredKicker: 'Heute auf der kleinen Bühne',
    featuredTitle: 'Drei wunderschön schlechte Ideen.',
    featuredLead:
      'Handgemachte Welten, riesige Probleme und gerade genug Platz für eure Crew.',
    catalogueKicker: 'Der Requisitenraum',
    catalogueTitle: 'Jedes Spiel im Yard.',
    catalogueLead: 'Öffnet eine Tür. Das Chaos ist schon aufgebaut.',
    partyKicker: 'Ein Raum-Code',
    partyTitle: 'Macht aus dem Spieleabend eine ganze Saison.',
    partyLead:
      'Versammelt eure Crew, spielt mehrere Minispiele und reicht die Krone weiter, bis jemand Revanche fordert.',
    partyButton: 'Party-Modus spielen',
    footerNote: 'Gute Gesellschaft. Fragwürdige Pläne.',
    backHome: 'Zum ursprünglichen Yard',
  },
};

export const BROADCAST_COPY: Localized<ConceptCopy> = {
  en: {
    navGames: "Tonight's lineup",
    heroKicker: 'Jumbleyard live · on air',
    heroTitle: 'Bring',
    heroAccent: 'the noise.',
    heroLead:
      "Tonight's lineup: quick games, loud friends, and absolutely no plan.",
    primaryAction: "See tonight's games",
    partyAction: 'Open party mode',
    gamesFact: '31 events',
    playersFact: '1–4 contestants',
    roundsFact: 'Live when you are',
    featuredKicker: 'Featured match',
    featuredTitle: 'Now entering the yard.',
    featuredLead:
      'Pick a matchup to change the channel. The action starts when your crew arrives.',
    catalogueKicker: 'Full schedule',
    catalogueTitle: 'Every event. Every bad call.',
    catalogueLead: 'Choose the next headline before somebody else does.',
    partyKicker: 'Jumbleyard special',
    partyTitle: 'One crew. A whole night of highlights.',
    partyLead:
      'Share a room code, rotate through the lineup, and settle the standings the loud way.',
    partyButton: 'Go to party mode',
    footerNote: 'The broadcast ends when your friends go home.',
    backHome: 'Back to the clubhouse',
  },
  de: {
    navGames: 'Das heutige Programm',
    heroKicker: 'Jumbleyard live · auf Sendung',
    heroTitle: 'Macht',
    heroAccent: 'richtig Lärm.',
    heroLead:
      'Das heutige Programm: schnelle Spiele, laute Freunde und absolut kein Plan.',
    primaryAction: 'Heutige Spiele ansehen',
    partyAction: 'Party-Modus öffnen',
    gamesFact: '31 Events',
    playersFact: '1–4 Kandidaten',
    roundsFact: 'Live, wenn ihr es seid',
    featuredKicker: 'Top-Match',
    featuredTitle: 'Jetzt im Yard.',
    featuredLead:
      'Wählt ein Match und wechselt den Kanal. Die Action beginnt mit eurer Crew.',
    catalogueKicker: 'Volles Programm',
    catalogueTitle: 'Jedes Event. Jede schlechte Entscheidung.',
    catalogueLead:
      'Bestimmt die nächste Schlagzeile, bevor es jemand anders tut.',
    partyKicker: 'Jumbleyard Spezial',
    partyTitle: 'Eine Crew. Ein ganzer Abend voller Highlights.',
    partyLead:
      'Teilt einen Raum-Code, spielt euch durchs Programm und klärt die Tabelle auf die laute Art.',
    partyButton: 'Zum Party-Modus',
    footerNote: 'Die Sendung endet, wenn eure Freunde nach Hause gehen.',
    backHome: 'Zurück zum Clubhaus',
  },
};

export const ARCADE_COPY: Localized<ConceptCopy> = {
  en: {
    navGames: 'Choose a cabinet',
    heroKicker: 'Jumbleyard.exe · four players ready',
    heroTitle: 'Insert',
    heroAccent: 'friends.',
    heroLead:
      'Press any bad idea to start. No download, no account, no quarters.',
    primaryAction: 'Choose a cabinet',
    partyAction: 'Load party mode',
    gamesFact: '31 cabinets',
    playersFact: '1–4 players',
    roundsFact: 'Unlimited continues',
    featuredKicker: 'Front row',
    featuredTitle: 'Your next high score problem.',
    featuredLead:
      'Use the arrow keys or tap a cabinet. Every machine opens a different clay-world disaster.',
    catalogueKicker: 'Cartridge wall',
    catalogueTitle: 'The whole arcade.',
    catalogueLead: 'No tokens. No queues. Just pick what breaks next.',
    partyKicker: 'Four slots connected',
    partyTitle: 'Load the full party run.',
    partyLead:
      'Bring everyone into one room and let the machine choose what comes next.',
    partyButton: 'Load party mode',
    footerNote: 'Please do not tilt the cabinet.',
    backHome: 'Exit to the clubhouse',
  },
  de: {
    navGames: 'Automat wählen',
    heroKicker: 'Jumbleyard.exe · vier Spieler bereit',
    heroTitle: 'Freunde',
    heroAccent: 'einwerfen.',
    heroLead:
      'Drückt irgendeine schlechte Idee zum Starten. Kein Download, kein Account, keine Münzen.',
    primaryAction: 'Automat wählen',
    partyAction: 'Party-Modus laden',
    gamesFact: '31 Automaten',
    playersFact: '1–4 Spieler',
    roundsFact: 'Unendlich Continues',
    featuredKicker: 'Erste Reihe',
    featuredTitle: 'Euer nächstes Highscore-Problem.',
    featuredLead:
      'Nutzt die Pfeiltasten oder tippt einen Automaten an. Jede Maschine öffnet ein anderes Clay-Chaos.',
    catalogueKicker: 'Modulwand',
    catalogueTitle: 'Die ganze Spielhalle.',
    catalogueLead:
      'Keine Münzen. Keine Schlange. Wählt einfach das nächste Chaos.',
    partyKicker: 'Vier Plätze verbunden',
    partyTitle: 'Ladet den kompletten Party-Lauf.',
    partyLead:
      'Bringt alle in einen Raum und lasst die Maschine auswählen, was als Nächstes kommt.',
    partyButton: 'Party-Modus laden',
    footerNote: 'Bitte den Automaten nicht kippen.',
    backHome: 'Zurück zum Clubhaus',
  },
};
