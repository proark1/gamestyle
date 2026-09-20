import { STATIONS, type Clue } from './types';

const names = ['Teppich', 'Porträt', 'Zimmer 309', 'Uhr'];
const normal = [
  'Der Teppich ist trocken. Keine Fußspuren.',
  'Das Porträt lächelt nicht. Seine Augen bleiben still.',
  'Zimmer 309 ist still. Die Tür bewegt sich nicht.',
  'Die Uhr zeigt 12:00. Beide Zeiger stehen still.',
];
const odd = [
  'Nasse Fußspuren erscheinen nacheinander. Niemand hinterlässt sie.',
  'Das Porträt lächelt. Seine Augen folgen mir.',
  'Dreimal klopft es in Zimmer 309. Die Klinke bewegt sich von selbst.',
  'Die Uhrzeiger laufen rückwärts.',
];
const alternate = {
  en: [
    'Wet footprints walk toward the elevator. Nobody is making them.',
    'The portrait rocks from side to side. Its painted face is smiling.',
    'Five quick knocks from room 309. The handle turns by itself.',
    'The clock hands spin forward much too fast.',
  ],
  de: [
    'Nasse Fußspuren laufen zum Aufzug. Niemand hinterlässt sie.',
    'Das Porträt schaukelt hin und her. Das gemalte Gesicht lächelt.',
    'Fünf schnelle Klopfzeichen aus Zimmer 309. Die Klinke bewegt sich von selbst.',
    'Die Uhrzeiger drehen sich viel zu schnell vorwärts.',
  ],
};

export function stationName(station: number, language: string) {
  return language === 'de' ? names[station] : STATIONS[station].name;
}
export function clueText(clue: Clue, language: string): string {
  const { station, variant } = clue;
  if (clue.odd && variant === 1)
    return alternate[language === 'de' ? 'de' : 'en'][station];
  if (language === 'de') return (clue.odd ? odd : normal)[station];
  return STATIONS[station][clue.odd ? 'odd' : 'normal'];
}

/** Old room checkpoints may still contain text-only findings. */
export function legacyFinding(text: string, language: string) {
  if (language !== 'de') return text;
  for (let station = 0; station < STATIONS.length; station++) {
    for (const unusual of [false, true]) {
      for (const variant of [0, 1]) {
        const clue = { station, odd: unusual, variant };
        if (clueText(clue, 'en') === text) return clueText(clue, 'de');
      }
    }
  }
  return text;
}
