import type { Localized } from '../../shared/language/types';

export interface CraneClashTranslation {
  tagline: string;
  desc: string;
  yourTeam: string;
  teamOrange: string;
  teamTeal: string;
  soloPrompt: string;
  yourRole: string;
  swingerSolo: string;
  swingerRole: string;
  operatorSolo: string;
  operatorRole: string;
  startMatch: string;
  matchOver: string;
  orangeWins: string;
  tealWins: string;
  draw: string;
  playAgain: string;
  crates: string;
  hintSwing: string;
  hintCraneRotate: string;
  hintHoist: string;
  hintGrabRelease: string;
  hintSwapKeys: string;
  hintCamera: string;
  hintSwingMomentum: string;
  hintGrabTossCrate: string;
  hintCraneControl: string;
  hintWinch: string;
}

export const CRANE_CLASH_TRANSLATIONS: Localized<CraneClashTranslation> = {
  en: {
    tagline: 'TWO CRANES. FOUR PLAYERS. WORKSITE MAYHEM.',
    desc: 'Swing through the air on the crane cable, grab wooden crates and stone blocks, and work with your crane operator to build the highest tower before time runs out!',
    yourTeam: 'Your Team',
    teamOrange: 'Team Orange',
    teamTeal: 'Team Teal',
    soloPrompt: 'Solo Mode: You control crane & cable simultaneously!',
    yourRole: 'Your Role',
    swingerSolo: 'Camera: Cable Acrobat',
    swingerRole: 'Cable Acrobat (Hanging)',
    operatorSolo: 'Camera: Crane Operator',
    operatorRole: 'Crane Operator (Cabin)',
    startMatch: 'Start Match',
    matchOver: 'Match Over!',
    orangeWins: 'Team Orange wins!',
    tealWins: 'Team Teal wins!',
    draw: 'Draw!',
    playAgain: 'Play Again',
    crates: 'crates',
    hintSwing: 'Swing',
    hintCraneRotate: 'Rotate crane & trolley',
    hintHoist: 'Hoist',
    hintGrabRelease: 'Grab / Release',
    hintSwapKeys: 'Swap keys',
    hintCamera: 'Camera',
    hintSwingMomentum: 'Swing & Momentum',
    hintGrabTossCrate: 'Grab / Toss crate',
    hintCraneControl: 'Steer crane',
    hintWinch: 'Cable hoist',
  },
  de: {
    tagline: 'ZWEI KRÄNE. VIER SPIELER. BAUSTELLEN-CHAOS.',
    desc: 'Schwinge am Seil durch die Luft, greife Holzkisten und Steinblöcke und baue mit deinem Kranführer den höchsten Turm vor Ablauf der Zeit!',
    yourTeam: 'Dein Team',
    teamOrange: 'Team Orange',
    teamTeal: 'Team Teal',
    soloPrompt: 'Solo-Modus: Du steuerst Kran & Seil gleichzeitig!',
    yourRole: 'Deine Rolle',
    swingerSolo: 'Kamera: Seil-Akrobat',
    swingerRole: 'Seil-Akrobat (Hängt)',
    operatorSolo: 'Kamera: Kranführer',
    operatorRole: 'Kranführer (Kabine)',
    startMatch: 'Match starten',
    matchOver: 'Match Vorbei!',
    orangeWins: 'Team Orange gewinnt!',
    tealWins: 'Team Teal gewinnt!',
    draw: 'Unentschieden!',
    playAgain: 'Nochmal spielen',
    crates: 'Kisten',
    hintSwing: 'Schaukeln',
    hintCraneRotate: 'Kran drehen & Katze',
    hintHoist: 'Winde',
    hintGrabRelease: 'Greifen / Werfen',
    hintSwapKeys: 'Tasten tauschen',
    hintCamera: 'Kamera',
    hintSwingMomentum: 'Schaukeln & Schwung',
    hintGrabTossCrate: 'Kiste Greifen / Werfen',
    hintCraneControl: 'Kran steuern',
    hintWinch: 'Seilwinde',
  },
};
