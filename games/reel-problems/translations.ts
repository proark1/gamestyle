import type { Localized } from '../../shared/language/types';

export interface ReelProblemsTranslation {
  fishingMayhem: string;
  boatBalance: string;
  tournamentCatch: string;
  squallWarning: string;
  holdToReel: string;
  castLine: string;
  brace: string;
  cutFree: string;
  untangle: string;
  pullAboard: string;
  boatCapsized: string;
  catchSuccess: string;
  launchBoat: string;
  joinFriends: string;
  playAgain: string;
}

export const REEL_PROBLEMS_TRANSLATIONS: Localized<ReelProblemsTranslation> = {
  en: {
    fishingMayhem: 'OFFSHORE ROWBOAT FISHING MAYHEM',
    boatBalance: 'Rowboat Balance',
    tournamentCatch: 'Tournament Haul',
    squallWarning: '⚠️ STORM SQUALL APPROACHING! ROW TO BALANCE!',
    holdToReel: 'Reel Line [HOLD SPACE]',
    castLine: 'Cast Lure [E]',
    brace: 'Brace Hull [SHIFT]',
    cutFree: 'Cut Snagged Line [X]',
    untangle: 'Untangle Lines [C]',
    pullAboard: 'Net Catch into Boat [F]',
    boatCapsized: 'ROWBOAT CAPSIZED! FISH FEASTED! 🦈',
    catchSuccess: 'TROPHY MONSTER BOATED! RECORD WEIGH-IN! 🐟',
    launchBoat: 'Launch a boat',
    joinFriends: 'Join friends',
    playAgain: 'Fish Again',
  },
  de: {
    fishingMayhem: 'HOCHSEE-RUDERBOOT-ANGELCHAOS',
    boatBalance: 'Ruderboot-Balance',
    tournamentCatch: 'Turnier-Fang',
    squallWarning: '⚠️ STURMBÖE NAHT! GEWICHT VERLAGERN!',
    holdToReel: 'Einholen [LEERTASTE]',
    castLine: 'Auswerfen [E]',
    brace: 'Festklammern [SHIFT]',
    cutFree: 'Schnur kappen [X]',
    untangle: 'Entwirren [C]',
    pullAboard: 'Fang ins Boot keschern [F]',
    boatCapsized: 'BOOT GEKENTERT! DIE FISCHE LACHEN! 🦈',
    catchSuccess: 'MONSTERFISCH GELANDET! REKORD-FELDZUG! 🐟',
    launchBoat: 'Boot zu Wasser lassen',
    joinFriends: 'Freunden beitreten',
    playAgain: 'Nochmal auslaufen',
  },
};
