import type { Localized } from '../../shared/language/types';

export interface ZorbClashTranslation {
  red: string;
  blue: string;
  bonks: string;
  radar: string;
  turtled: string;
  turtledSub: string;
  goal: string;
  goalSub: string;
  ownGoalSub: string;
  teamGoal: string;
  intro: string;
  start: string;
  paused: string;
  resume: string;
  keyboardHelp: string;
  touchHelp: string;
  recoveryHint: string;
  recovering: string;
  unstable: string;
  you: string;
  roll: string;
  bumperDash: string;
  braceAnchor: string;
  brace: string;
  dash: string;
  matchOver: string;
  explosiveDraw: string;
  redTrophy: string;
  blueTrophy: string;
  explosiveBonks: string;
  finalScore: string;
  rematch: string;
}

export const ZORB_CLASH_TRANSLATIONS: Localized<ZorbClashTranslation> = {
  en: {
    red: 'Red',
    blue: 'Blue',
    bonks: 'BONKS',
    radar: 'RADAR',
    turtled: 'KNOCKED DOWN',
    turtledSub:
      'Hold a movement key to get up faster once your ball slows down.',
    goal: 'GOOOAL! ⚽',
    goalSub: '{scorer} scored for {team}!',
    ownGoalSub: 'Own goal by {scorer} — point for {team}.',
    teamGoal: 'Point for {team}!',
    intro:
      'You play for Red. Push the beach ball into the Blue goal at the far end. First to 5 goals, or the lead after 3 minutes, wins. Player bubbles never count as goals.',
    start: 'Start match',
    paused: 'Match paused',
    resume: 'Continue',
    keyboardHelp:
      'Run with WASD or arrow keys. Hold Space to charge a dash, release to sprint. Hold Shift to brace.',
    touchHelp:
      'Drag the left stick to run. Hold Dash to charge, release to sprint. Hold Brace to steady yourself.',
    recoveryHint:
      'Hold the stick in any direction to get up faster once your ball slows down.',
    recovering: 'Getting up…',
    unstable: 'Losing balance — ease off or brace',
    you: 'You',
    roll: 'Run',
    bumperDash: 'Bumper Dash',
    braceAnchor: 'Brace Anchor',
    brace: 'Brace',
    dash: 'Dash',
    matchOver: 'MATCH OVER!',
    explosiveDraw: "It's an explosive draw!",
    redTrophy: 'Red Team Takes the Trophy! 🏆',
    blueTrophy: 'Blue Team Takes the Trophy! 🏆',
    explosiveBonks: 'Explosive Bonks',
    finalScore: 'Final Score',
    rematch: 'Rematch!',
  },
  de: {
    red: 'Rot',
    blue: 'Blau',
    bonks: 'CRASHES',
    radar: 'RADAR',
    turtled: 'UMGEFALLEN',
    turtledSub:
      'Eine Richtungstaste halten, um schneller aufzustehen, sobald die Kugel langsamer wird.',
    goal: 'TOOOOR! ⚽',
    goalSub: '{scorer} trifft für {team}!',
    ownGoalSub: 'Eigentor von {scorer} — Punkt für {team}.',
    teamGoal: 'Punkt für {team}!',
    intro:
      'Du spielst für Rot. Schiebe den Spielball ins blaue Tor am anderen Feldende. Wer zuerst 5 Tore erzielt oder nach 3 Minuten führt, gewinnt. Spielerkugeln zählen nie als Tor.',
    start: 'Spiel starten',
    paused: 'Spiel pausiert',
    resume: 'Weiter',
    keyboardHelp:
      'Mit WASD oder Pfeiltasten laufen. Leertaste zum Aufladen halten, zum Sprinten loslassen. Umschalttaste zum Stemmen halten.',
    touchHelp:
      'Den linken Stick zum Laufen ziehen. Sprint zum Aufladen halten, zum Sprinten loslassen. Stemmen halten, um stabil zu bleiben.',
    recoveryHint:
      'Den Stick in eine Richtung halten, um schneller aufzustehen, sobald die Kugel langsamer wird.',
    recovering: 'Steht auf…',
    unstable: 'Gleichgewicht verloren — langsamer laufen oder stemmen',
    you: 'Du',
    roll: 'Laufen',
    bumperDash: 'Bumper-Sprint',
    braceAnchor: 'Stemmen',
    brace: 'Stemmen',
    dash: 'Sprint',
    matchOver: 'SPIEL VORBEI!',
    explosiveDraw: 'Ein explosives Unentschieden!',
    redTrophy: 'Team Rot holt die Trophäe! 🏆',
    blueTrophy: 'Team Blau holt die Trophäe! 🏆',
    explosiveBonks: 'Explosive Zusammenstöße',
    finalScore: 'Endstand',
    rematch: 'Revanche!',
  },
};
