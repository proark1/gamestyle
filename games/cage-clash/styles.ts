import type { Fighter, Style } from './types';
export const STYLES = {
  boxer: {
    name: 'Boxer',
    de: 'Boxer',
    line: 'Fast hands. Sharp counters.',
    detail:
      'Efficient combinations and heavy hands. Close the gap; keep it standing.',
    german:
      'Schnelle Kombinationen, starke Fäuste. Geh nah ran und bleib auf den Beinen.',
    punch: 1.22,
    kick: 0.8,
    takedown: 0.8,
    ground: 0.8,
    submission: 0.72,
    speed: 1.05,
  },
  kickboxer: {
    name: 'Kickboxer',
    de: 'Kickboxer',
    line: 'Own the distance.',
    detail:
      'Long, powerful kicks. A missed kick leaves your legs open to a takedown.',
    german:
      'Lange, starke Tritte. Ein Fehlschlag öffnet deine Deckung für Takedowns.',
    punch: 1,
    kick: 1.3,
    takedown: 0.78,
    ground: 0.8,
    submission: 0.75,
    speed: 1,
  },
  'jiu-jitsu': {
    name: 'Jiu-jitsu',
    de: 'Jiu-Jitsu',
    line: 'Dangerous from underneath.',
    detail:
      'Reverse positions and find submissions. Survive the approach to the ground.',
    german:
      'Drehe Positionen um und suche Aufgabegriffe. Überstehe den Weg zum Boden.',
    punch: 0.85,
    kick: 0.85,
    takedown: 1.02,
    ground: 1.3,
    submission: 1.4,
    speed: 0.97,
  },
  mma: {
    name: 'MMA fighter',
    de: 'MMA-Kämpfer',
    line: 'Change the fight.',
    detail:
      'Strong takedowns and balanced tools. Connect your strikes with grappling.',
    german:
      'Starke Takedowns und vielseitige Angriffe. Verbinde Schläge mit Ringen.',
    punch: 1,
    kick: 1,
    takedown: 1.3,
    ground: 1.08,
    submission: 1,
    speed: 1,
  },
} as const;
export const STYLE_IDS = Object.keys(STYLES) as Style[];
export const isStyle = (s: unknown): s is Style =>
  typeof s === 'string' && Object.hasOwn(STYLES, s);
export const stats = (p: Fighter) => STYLES[p.style ?? 'mma'];
export const score = (p: Fighter) =>
  Math.round(p.damage) + p.takedowns * 8 + p.advances * 5;
