import type { Localized } from '../../shared/language/types';

export interface BungeeDoublesTranslation {
  orbitHint: string;
  red: string;
  blue: string;
  team: string;
  serving: string;
  rally: string;
  hotStreak: string;
  bungeeStrain: string;
  criticalSnap: string;
  slingshotReady: string;
  rallyUpdate: string;
  wins: string;
  matchComplete: string;
  playAgain: string;
  volley: string;
  smash: string;
  dive: string;
  switchTeam: string;
  camera: string;
  reset: string;
  touchCam: string;
  touchSmash: string;
  touchDive: string;
  touchHit: string;
}

export const BUNGEE_DOUBLES_TRANSLATIONS: Localized<BungeeDoublesTranslation> =
  {
    en: {
      orbitHint: 'Drag court to orbit 360°',
      red: 'Red',
      blue: 'Blue',
      team: 'Team',
      serving: 'Serving',
      rally: 'RALLY',
      hotStreak: 'HOT STREAK!',
      bungeeStrain: 'BUNGEE STRAIN',
      criticalSnap: 'CRITICAL SNAP DANGER!',
      slingshotReady: 'SLINGSHOT READY',
      rallyUpdate: 'RALLY UPDATE',
      wins: 'WINS!',
      matchComplete: 'Championship Match Complete',
      playAgain: 'Play Again',
      volley: 'Volley',
      smash: 'Smash',
      dive: 'Dive',
      switchTeam: 'Switch Team',
      camera: 'Camera',
      reset: 'Reset',
      touchCam: 'CAM',
      touchSmash: 'SMASH',
      touchDive: 'DIVE',
      touchHit: 'HIT',
    },
    de: {
      orbitHint: 'Spielfeld ziehen für 360°-Drehung',
      red: 'Rot',
      blue: 'Blau',
      team: 'Team',
      serving: 'Aufschlag',
      rally: 'BALLWECHSEL',
      hotStreak: 'HEISSE SERIE!',
      bungeeStrain: 'BUNGEE-SPANNUNG',
      criticalSnap: 'AKUTE REISSGEFAHR!',
      slingshotReady: 'KATAPULT BEREIT',
      rallyUpdate: 'BALLWECHSEL',
      wins: 'GEWINNT!',
      matchComplete: 'Meisterschaftsspiel beendet',
      playAgain: 'Nochmal spielen',
      volley: 'Volley',
      smash: 'Schmettern',
      dive: 'Hechten',
      switchTeam: 'Team wechseln',
      camera: 'Kamera',
      reset: 'Zurücksetzen',
      touchCam: 'KAM',
      touchSmash: 'SMASH',
      touchDive: 'HECHTEN',
      touchHit: 'SCHLAG',
    },
  };
