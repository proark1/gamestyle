import type { Localized } from '../../shared/language/types';

/**
 * What a prompt calls each control: a key on a keyboard, the on-screen button
 * on a touch device. `tap` prefixes a one-shot control, `press` is the verb.
 */
export type KeyLabels = {
  help: string;
  brace: string;
  clip: string;
  jump: string;
  tap: string;
  press: string;
};

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
  routeHints: Record<string, string>;
  distanceLeft: (metres: number) => string;
  checkpointSaved: (count: number, total: number) => string;

  keys: { desktop: KeyLabels; touch: KeyLabels };
  promptHaul: (name: string, k: KeyLabels) => string;
  promptRevive: (name: string, k: KeyLabels) => string;
  promptBrace: (k: KeyLabels) => string;
  promptClip: (k: KeyLabels) => string;
  promptUnclip: (k: KeyLabels) => string;
  promptHook: (k: KeyLabels) => string;
  promptNet: (touch: boolean) => string;
  youDangling: (k: KeyLabels) => string;
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
      'yard-run': 'Cargo chicane',
      'last-crossing': 'Last crossing',
      'office-approach': 'Office approach',
      office: 'Site office',
    },
    distanceLeft: (m) => `${m} m to go`,
    checkpointSaved: (n, total) => `Checkpoints ${n}/${total}`,
    routeHints: {
      gate: 'Follow the beams ahead. Keep your crew close.',
      girders: 'Jump the gaps, or drop to the lower catwalk.',
      scaffold: 'Jump up the steps. Let the rest of the line catch up.',
      plank: 'Spread your weight across the plank. Move together.',
      wrecking: 'Wait for the ball to pass, then cross as a crew.',
      pipe: 'Single file through the duct. Stay close to avoid a yank.',
      net: 'Walk onto the net, then push forward to climb down.',
      'yard-run': 'Jump the cargo, or weave around the open ends.',
      'last-crossing': 'One last gap. Regroup before you jump.',
      'office-approach': 'Bring every worker across the chequered line.',
    },

    keys: {
      desktop: {
        help: 'F',
        brace: 'Shift',
        clip: 'E',
        jump: 'Space',
        tap: '',
        press: 'press',
      },
      touch: {
        help: 'Help',
        brace: 'Brace',
        clip: 'Clip',
        jump: 'Jump',
        tap: 'Tap ',
        press: 'tap',
      },
    },
    promptHaul: (name, k) => `Hold ${k.help} — haul ${name} up`,
    promptRevive: (name, k) => `Hold ${k.help} — get ${name} up`,
    promptBrace: (k) => `Hold ${k.brace} — someone is over!`,
    promptClip: (k) => `${k.tap}${k.clip} — clip the line to this ring`,
    promptUnclip: (k) => `${k.tap}${k.clip} — unclip and move on`,
    promptHook: (k) => `${k.tap}${k.clip} — grab the hook to stall the ball`,
    promptNet: (touch) =>
      touch
        ? 'Push forward to climb down · Jump lets go'
        : 'Forward climbs down · Space lets go',
    youDangling: (k) =>
      `You're over the edge — ${k.press} ${k.jump} to kick, wait for a haul`,
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
      'yard-run': 'Fracht-Slalom',
      'last-crossing': 'Letzte Überquerung',
      'office-approach': 'Weg zum Büro',
      office: 'Baubüro',
    },
    distanceLeft: (m) => `Noch ${m} m`,
    checkpointSaved: (n, total) => `Kontrollpunkte ${n}/${total}`,
    routeHints: {
      gate: 'Folgt den Trägern. Haltet die Crew zusammen.',
      girders: 'Springt über die Lücken oder nehmt den unteren Steg.',
      scaffold: 'Springt die Stufen hoch. Wartet auf den Rest der Crew.',
      plank: 'Verteilt euer Gewicht. Geht gemeinsam über das Brett.',
      wrecking: 'Wartet auf die Abrissbirne und geht dann gemeinsam los.',
      pipe: 'Im Gänsemarsch durchs Rohr. Bleibt nah zusammen.',
      net: 'Geht aufs Netz und drückt vorwärts zum Absteigen.',
      'yard-run': 'Springt über die Fracht oder lauft außen herum.',
      'last-crossing': 'Noch eine Lücke. Sammelt euch vor dem Sprung.',
      'office-approach': 'Bringt alle über die Ziellinie.',
    },

    keys: {
      desktop: {
        help: 'F',
        brace: 'Shift',
        clip: 'E',
        jump: 'Leertaste',
        tap: '',
        press: 'drücke',
      },
      touch: {
        help: 'Helfen',
        brace: 'Stemmen',
        clip: 'Haken',
        jump: 'Springen',
        tap: 'Tippe ',
        press: 'tippe',
      },
    },
    promptHaul: (name, k) => `${k.help} halten – ${name} hochziehen`,
    promptRevive: (name, k) => `${k.help} halten – ${name} aufhelfen`,
    promptBrace: (k) => `${k.brace} halten – jemand hängt!`,
    promptClip: (k) => `${k.tap}${k.clip} – Kette in den Ring einhaken`,
    promptUnclip: (k) => `${k.tap}${k.clip} – aushaken und weiter`,
    promptHook: (k) => `${k.tap}${k.clip} – Haken greifen, Abrissbirne bremsen`,
    promptNet: (touch) =>
      touch
        ? 'Vorwärts drücken klettert runter · Springen lässt los'
        : 'Vorwärts klettert runter · Leertaste lässt los',
    youDangling: (k) =>
      `Du hängst über der Kante – ${k.press} ${k.jump} zum Strampeln, warte auf Hilfe`,
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
