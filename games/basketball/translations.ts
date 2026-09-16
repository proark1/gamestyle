import type { Localized } from '../../shared/language/types';

export interface BasketballTranslation {
  tagline: string;
  desc: string;
  teamOrange: string;
  teamTeal: string;
  startMatch: string;
  matchEnded: string;
  teamWins: string;
  playRematch: string;
  clearBall: string;
  hintMove: string;
  hintShootDunk: string;
  hintCrossover: string;
  hintSpin: string;
  hintStepBack: string;
  hintPass: string;
  hintSprint: string;
  hintSuperJump: string;
  hintCamera: string;
}

export const BASKETBALL_TRANSLATIONS: Localized<BasketballTranslation> = {
  en: {
    tagline: '2v2 Street Basketball in Jumbleyard style',
    desc: 'Compete in 2-on-2 matchups! Dribble, break ankles with crossovers, shoot step-backs, dish alley-oops, and charge your combo bar for spectacular super jumps and slam dunks!',
    teamOrange: 'Team Orange',
    teamTeal: 'Team Teal',
    startMatch: 'Start Match (to 15 pts)',
    matchEnded: 'Match Ended!',
    teamWins: 'Team {team} wins the game!',
    playRematch: 'Play Rematch',
    clearBall: 'Clear ball (3PT)',
    hintMove: 'Move',
    hintShootDunk: 'Shoot / Dunk',
    hintCrossover: 'Crossover',
    hintSpin: '360° Spin',
    hintStepBack: 'Step-Back',
    hintPass: 'Pass / Alley-Oop',
    hintSprint: 'Sprint',
    hintSuperJump: 'Super Jump',
    hintCamera: 'Camera',
  },
  de: {
    tagline: '2v2 Street Basketball im Jumbleyard-Stil',
    desc: 'Tritt im 2-gegen-2 Match an! Dribble, breche Knöchel mit Crossovern, wirf Step-Backs, passe spektakuläre Alley-Oops und lade die Combo-Leiste für spektakuläre Super-Jumps und Slam Dunks auf!',
    teamOrange: 'Team Orange',
    teamTeal: 'Team Teal',
    startMatch: 'Match starten (bis 15 Pkt.)',
    matchEnded: 'Match Beendet!',
    teamWins: 'Team {team} gewinnt das Spiel!',
    playRematch: 'Rematch spielen',
    clearBall: 'Ball klären (3er)',
    hintMove: 'Bewegen',
    hintShootDunk: 'Werfen / Dunken',
    hintCrossover: 'Crossover',
    hintSpin: '360° Spin',
    hintStepBack: 'Step-Back',
    hintPass: 'Pass / Alley-Oop',
    hintSprint: 'Sprint',
    hintSuperJump: 'Super Jump',
    hintCamera: 'Kamera',
  },
};
