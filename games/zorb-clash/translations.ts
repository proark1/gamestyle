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
  turtleGoal: string;
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
    turtled: "TURTLE'D! 🐢",
    turtledSub: 'Wiggle WASD to roll over or get rammed by a teammate!',
    goal: 'GOOOAL! ⚽',
    goalSub: '{scorer} scored for {team}!',
    turtleGoal: '🔥 TURTLE GOAL! BONUS STYLE POINTS! 🔥',
    roll: 'Roll',
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
    turtled: 'AUF DEM RÜCKEN! 🐢',
    turtledSub: 'Mit WASD zappeln oder von Teamkollegen rammen lassen!',
    goal: 'TOOOOR! ⚽',
    goalSub: '{scorer} trifft für {team}!',
    turtleGoal: '🔥 SCHILDKRÖTEN-TOR! STYLE-BONUS! 🔥',
    roll: 'Rollen',
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
