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
  switchDesc: string;
  switchRules: [string, string, string];
  startShift: string;
  playAgain: string;
  mapLabel: string;
  mapClassicName: string;
  mapClassicDesc: string;
  mapSwitchName: string;
  mapSwitchDesc: string;
  switchPrompt: (active: number, total: number) => string;

  hudTime: string;
  hudWipes: string;
  hudLine: string;
  hudGrip: string;
  sections: Record<string, string>;
  routeHints: Record<string, string>;
  distanceLeft: (metres: number) => string;
  bestDistance: (metres: number) => string;
  resetNotice: string;
  sectionProgress: (count: number, total: number) => string;

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
      'Lose the crew and everyone restarts at the gate. No checkpoints.',
    ],
    switchDesc:
      'Open both crew gates by standing on separate pressure plates together. Stay linked across the exposed spans and bring every worker to the office.',
    switchRules: [
      'The first gate needs two workers; the second needs all four.',
      'Hold every plate together until the gate latches open.',
      'Brace, clip and haul teammates across the exposed gaps.',
    ],
    startShift: 'Start the shift',
    playAgain: 'Another shift',
    mapLabel: 'Choose a map',
    mapClassicName: 'Demolition Site',
    mapClassicDesc: 'The original route of beams, scaffolds and wrecking gear.',
    mapSwitchName: 'Switchyard',
    mapSwitchDesc:
      'Split the crew across switches to open gates, then cross the exposed spans.',
    switchPrompt: (active, total) =>
      `Stand on separate floor switches together · ${active}/${total} held`,

    hudTime: 'Shift',
    hudWipes: 'Attempt',
    bestDistance: (m) => `Best ${m} m`,
    resetNotice: 'Crew lost · Back to the gate',
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
      'switch-pair': 'Two-worker gate',
      'switch-spans': 'Exposed spans',
      'switch-crew': 'Whole-crew gate',
      'switch-final': 'Final crossing',
      'switch-office': 'Crew office',
    },
    distanceLeft: (m) => `${m} m to go`,
    sectionProgress: (n, total) => `Sections ${n}/${total} · No checkpoints`,
    routeHints: {
      gate: 'One crew. One attempt. A lost crew restarts at the gate.',
      girders: 'Aim for the offset beams. The lower path twists underneath.',
      scaffold: 'Climb together. Wait for the suspended load to clear the top.',
      plank: 'Spread your weight across the plank. Move together.',
      wrecking: 'Wait for the ball to pass, then cross as a crew.',
      pipe: 'Single file through the duct. Stay close to avoid a yank.',
      net: 'Walk onto the net, then push forward to climb down.',
      'yard-run': 'Ride the moving deck, then weave around the tall cargo.',
      'last-crossing':
        'Regroup at the gap. Watch the load sweeping the far bridge.',
      'office-approach': 'Bring every worker across the chequered line.',
      'switch-pair': 'Two workers need to hold separate pads at the same time.',
      'switch-spans': 'Cross one at a time. Brace and haul anyone who misses.',
      'switch-crew': 'All four workers must stand on their own pad together.',
      'switch-final': 'Clip or brace while the rest cross the last gap.',
      'switch-office': 'Bring the entire line over the finish tape.',
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
      'Verliert ihr die Crew, starten alle wieder am Tor. Keine Kontrollpunkte.',
    ],
    switchDesc:
      'Öffnet beide Tore, indem ihr gleichzeitig auf getrennten Druckplatten steht. Bleibt auf den schmalen Stegen verbunden und bringt alle ins Büro.',
    switchRules: [
      'Das erste Tor braucht zwei Arbeiter, das zweite alle vier.',
      'Haltet alle Platten gleichzeitig, bis das Tor offen bleibt.',
      'Stemmt euch ab, hakt euch ein und zieht andere über die Lücken.',
    ],
    startShift: 'Schicht beginnen',
    playAgain: 'Noch eine Schicht',
    mapLabel: 'Karte wählen',
    mapClassicName: 'Abrissgelände',
    mapClassicDesc:
      'Der ursprüngliche Weg über Träger, Gerüste und Abrissgeräte.',
    mapSwitchName: 'Schaltgelände',
    mapSwitchDesc:
      'Verteilt die Crew auf Schalter, öffnet Tore und überquert schmale Stege.',
    switchPrompt: (active, total) =>
      `Steht gleichzeitig auf getrennten Schaltern · ${active}/${total} besetzt`,

    hudTime: 'Schicht',
    hudWipes: 'Versuch',
    bestDistance: (m) => `Rekord ${m} m`,
    resetNotice: 'Crew abgestürzt · Zurück zum Tor',
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
      'switch-pair': 'Zweiertor',
      'switch-spans': 'Schmale Stege',
      'switch-crew': 'Crewtor',
      'switch-final': 'Letzter Übergang',
      'switch-office': 'Crew-Büro',
    },
    distanceLeft: (m) => `Noch ${m} m`,
    sectionProgress: (n, total) =>
      `Abschnitte ${n}/${total} · Kein Speicherpunkt`,
    routeHints: {
      gate: 'Eine Crew. Ein Versuch. Bei einem Absturz zurück zum Tor.',
      girders: 'Zielt auf die versetzten Träger. Der untere Steg macht Kurven.',
      scaffold: 'Klettert gemeinsam. Wartet oben auf eine freie Lücke.',
      plank: 'Verteilt euer Gewicht. Geht gemeinsam über das Brett.',
      wrecking: 'Wartet auf die Abrissbirne und geht dann gemeinsam los.',
      pipe: 'Im Gänsemarsch durchs Rohr. Bleibt nah zusammen.',
      net: 'Geht aufs Netz und drückt vorwärts zum Absteigen.',
      'yard-run':
        'Fahrt auf der Frachtplattform. Umgeht dann die hohen Kisten.',
      'last-crossing':
        'Sammelt euch am Spalt. Achtet auf die schwingende Last.',
      'office-approach': 'Bringt alle über die Ziellinie.',
      'switch-pair':
        'Zwei Arbeiter müssen gleichzeitig getrennte Schalter halten.',
      'switch-spans':
        'Einer nach dem anderen. Stützt und zieht Abgestürzte hoch.',
      'switch-crew':
        'Alle vier Arbeiter müssen gleichzeitig einen eigenen Schalter halten.',
      'switch-final':
        'Hakt euch ein oder stemmt euch ab, während die anderen springen.',
      'switch-office': 'Bringt die gesamte Kette über die Ziellinie.',
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
