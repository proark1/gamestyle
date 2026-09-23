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
  switchRelayPrompt: (charged: number, total: number) => string;

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
      'Cross a long chain of broken conveyors and rescue spans. Open the two crew locks, then solve the numbered relay with three different workers before the final crossing.',
    switchRules: [
      'First split into two, then place all four on separate pads.',
      'At the relay, press plates 2, 1, 3 in order with a new worker each time.',
      'Change lanes on wide decks; clip, brace and haul at the broken spans.',
    ],
    startShift: 'Start the shift',
    playAgain: 'Another shift',
    mapLabel: 'Choose a map',
    mapClassicName: 'Demolition Site',
    mapClassicDesc: 'The original route of beams, scaffolds and wrecking gear.',
    mapSwitchName: 'Switchyard',
    mapSwitchDesc:
      'A long teamwork gauntlet of switches, relay clues and rescue crossings.',
    switchPrompt: (active, total) =>
      `Stand on separate floor switches together · ${active}/${total} held`,
    switchRelayPrompt: (charged, total) =>
      `Relay 2 → 1 → 3 · ${charged}/${total} charged · use a different worker`,

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
      'switch-transfer': 'Conveyor approach',
      'switch-conveyor': 'Broken conveyor',
      'switch-rescue': 'Rescue split',
      'switch-relay': 'Numbered relay',
      'switch-anchor': 'Anchor run',
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
      'switch-transfer':
        'Regroup before the broken conveyor. Its lanes change twice.',
      'switch-conveyor':
        'Jump each break and swap lanes on the wide turn decks.',
      'switch-rescue':
        'Clip a ring, brace, and haul a worker if the gap catches them.',
      'switch-relay': 'Three different workers: press 2, then 1, then 3.',
      'switch-anchor':
        'Leap in order and keep a worker anchored near each gap.',
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
      'Überquert lange Reihen kaputter Förderstege und rettet euch an den Lücken. Öffnet zwei Crew-Tore und löst danach das nummerierte Relais mit drei verschiedenen Arbeitern.',
    switchRules: [
      'Zuerst braucht ihr zwei Arbeiter, danach alle vier auf eigenen Platten.',
      'Beim Relais drückt ihr 2, 1, 3 der Reihe nach – jeweils mit jemand anderem.',
      'Wechselt auf breiten Decks die Spur; hakt euch ein und rettet andere.',
    ],
    startShift: 'Schicht beginnen',
    playAgain: 'Noch eine Schicht',
    mapLabel: 'Karte wählen',
    mapClassicName: 'Abrissgelände',
    mapClassicDesc:
      'Der ursprüngliche Weg über Träger, Gerüste und Abrissgeräte.',
    mapSwitchName: 'Schaltgelände',
    mapSwitchDesc:
      'Ein langer Team-Parcours mit Schaltern, Relais und Rettungssprüngen.',
    switchPrompt: (active, total) =>
      `Steht gleichzeitig auf getrennten Schaltern · ${active}/${total} besetzt`,
    switchRelayPrompt: (charged, total) =>
      `Relais 2 → 1 → 3 · ${charged}/${total} geladen · immer ein anderer Arbeiter`,

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
      'switch-transfer': 'Förderband-Zugang',
      'switch-conveyor': 'Kaputtes Förderband',
      'switch-rescue': 'Rettungsspalte',
      'switch-relay': 'Nummeriertes Relais',
      'switch-anchor': 'Ankerlauf',
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
      'switch-transfer':
        'Sammelt euch vor dem Förderband. Die Spur wechselt zweimal.',
      'switch-conveyor':
        'Springt über die Lücken und wechselt auf breiten Decks die Spur.',
      'switch-rescue':
        'Hakt euch ein, stemmt euch ab und zieht Gefallene hoch.',
      'switch-relay': 'Drei verschiedene Arbeiter: erst 2, dann 1, dann 3.',
      'switch-anchor':
        'Springt nacheinander und sichert die Crew an jeder Lücke.',
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
