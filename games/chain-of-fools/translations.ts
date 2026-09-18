import type { Localized } from '../../shared/language/types';

export interface ChainTranslations {
  titleMain: string;
  titleHighlight: string;
  tagline: string;
  desc: string;
  rules: [string, string, string];
  startShift: string;
  playAgain: string;

  hudTime: string;
  hudWipes: string;
  hudLine: string;
  hudGrip: string;
  sections: Record<string, string>;

  promptHaul: (name: string) => string;
  promptRevive: (name: string) => string;
  promptBrace: string;
  promptClip: string;
  promptUnclip: string;
  promptHook: string;
  promptNet: string;
  youDangling: string;
  youLimp: string;
  youClipped: string;
  exhausted: string;

  wonTitle: string;
  wonDesc: (seconds: number, wipes: number) => string;
  lostTitle: string;
  lostDesc: (section: string) => string;
  score: string;

  hintMove: string;
  hintJump: string;
  hintBrace: string;
  hintHelp: string;
  hintClip: string;
  hintCall: string;
  hintCamera: string;

  touchBrace: string;
  touchHelp: string;
  touchClip: string;
  cameraModes: Record<'crew' | 'close' | 'side', string>;
}

export const CHAIN_TRANSLATIONS: Localized<ChainTranslations> = {
  en: {
    titleMain: 'Chain of ',
    titleHighlight: 'Fools',
    tagline: 'FOUR WORKERS. ONE SAFETY LINE. NO UNCLIPPING.',
    desc: 'Get the whole crew across a half-demolished site to the office. You are all on one chain: if one of you goes over, the rest of you are holding them — or following them.',
    rules: [
      'Two braced workers can hold two who fell. One cannot hold three.',
      'Haul danglers back up before the whole line goes over.',
      'Most obstacles have a fast way and a safe way. Pick as a crew.',
    ],
    startShift: 'Start the shift',
    playAgain: 'Another shift',

    hudTime: 'Shift',
    hudWipes: 'Wipes',
    hudLine: 'Line',
    hudGrip: 'Grip',
    sections: {
      gate: 'Site gate',
      girders: 'Girder run',
      scaffold: 'Scaffold climb',
      plank: 'Tipping plank',
      wrecking: 'Wrecking ledge',
      pipe: 'Pipe crawl',
      net: 'Cargo net',
      'yard-run': 'Lower yard',
      office: 'Site office',
    },

    promptHaul: (name) => `Hold F — haul ${name} up`,
    promptRevive: (name) => `Hold F — get ${name} up`,
    promptBrace: 'Hold Shift — brace! Someone is over',
    promptClip: 'E — clip the line to the ring',
    promptUnclip: 'E — unclip and move on',
    promptHook: 'E — grab the wrecking hook to stall it',
    promptNet: 'Forward climbs down · Space lets go',
    youDangling: 'You are over the edge — kick with Space, wait for a haul',
    youLimp: 'Winded! Dead weight until someone helps you up',
    youClipped: 'Clipped on: nobody can drag you',
    exhausted: 'Arms gave out',

    wonTitle: 'Clocked in!',
    wonDesc: (s, w) =>
      w === 0
        ? `The whole crew made the office with ${s}s to spare, and nobody went over together once.`
        : `The whole crew made the office with ${s}s to spare, after ${w} full-line ${w === 1 ? 'wipe' : 'wipes'}.`,
    lostTitle: 'Shift over',
    lostDesc: (section) =>
      `The horn went with the crew still at the ${section}.`,
    score: 'Crew score',

    hintMove: 'Move',
    hintJump: 'Jump',
    hintBrace: 'Brace',
    hintHelp: 'Haul / help',
    hintClip: 'Clip',
    hintCall: 'Call crew',
    hintCamera: 'Camera',

    touchBrace: 'Brace',
    touchHelp: 'Help',
    touchClip: 'Clip',
    cameraModes: { crew: 'Crew', close: 'Close', side: 'Side' },
  },
  de: {
    titleMain: 'Chain of ',
    titleHighlight: 'Fools',
    tagline: 'VIER ARBEITER. EINE SICHERUNGSKETTE. KEIN AUSHAKEN.',
    desc: 'Bringt die ganze Crew über eine halb abgerissene Baustelle ins Baubüro. Ihr hängt alle an einer Kette: Stürzt einer ab, hält ihn der Rest – oder fällt hinterher.',
    rules: [
      'Zwei, die sich abstemmen, halten zwei Abgestürzte. Einer hält keine drei.',
      'Zieht Hängende hoch, bevor die ganze Kette abrutscht.',
      'Fast jedes Hindernis hat einen schnellen und einen sicheren Weg. Entscheidet gemeinsam.',
    ],
    startShift: 'Schicht beginnen',
    playAgain: 'Noch eine Schicht',

    hudTime: 'Schicht',
    hudWipes: 'Abstürze',
    hudLine: 'Kette',
    hudGrip: 'Halt',
    sections: {
      gate: 'Bauzaun',
      girders: 'Trägerlauf',
      scaffold: 'Gerüstaufstieg',
      plank: 'Kippbrett',
      wrecking: 'Abrisskante',
      pipe: 'Rohrkriechgang',
      net: 'Frachtnetz',
      'yard-run': 'Unterer Hof',
      office: 'Baubüro',
    },

    promptHaul: (name) => `F halten – ${name} hochziehen`,
    promptRevive: (name) => `F halten – ${name} aufhelfen`,
    promptBrace: 'Shift halten – abstemmen! Jemand hängt',
    promptClip: 'E – Kette in den Ring einhaken',
    promptUnclip: 'E – aushaken und weiter',
    promptHook: 'E – Abrisshaken greifen und bremsen',
    promptNet: 'Vorwärts klettert runter · Leertaste loslassen',
    youDangling:
      'Du hängst über der Kante – strampeln mit Leertaste, auf Hilfe warten',
    youLimp: 'Die Luft ist weg! Totes Gewicht, bis dir jemand aufhilft',
    youClipped: 'Eingehakt: dich zieht niemand weg',
    exhausted: 'Die Arme geben nach',

    wonTitle: 'Eingestempelt!',
    wonDesc: (s, w) =>
      w === 0
        ? `Die ganze Crew ist mit ${s} s Reserve im Baubüro – und nie gemeinsam abgestürzt.`
        : `Die ganze Crew ist mit ${s} s Reserve im Baubüro, nach ${w} ${w === 1 ? 'Komplettabsturz' : 'Komplettabstürzen'}.`,
    lostTitle: 'Schichtende',
    lostDesc: (section) =>
      `Die Sirene ging, als die Crew noch bei: ${section} war.`,
    score: 'Crew-Punkte',

    hintMove: 'Laufen',
    hintJump: 'Springen',
    hintBrace: 'Abstemmen',
    hintHelp: 'Ziehen / helfen',
    hintClip: 'Einhaken',
    hintCall: 'Crew rufen',
    hintCamera: 'Kamera',

    touchBrace: 'Stemmen',
    touchHelp: 'Helfen',
    touchClip: 'Haken',
    cameraModes: { crew: 'Crew', close: 'Nah', side: 'Seite' },
  },
};
