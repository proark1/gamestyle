import type { Localized } from '../../shared/language/types';

export interface ActNaturalTranslation {
  suspiciousPartyGame: string;
  createFarm: string;
  joinCode: string;
  soloPractice: string;
  cowHeist: string;
  grazeDisguise: string;
  blendIn: string;
  graze: string;
  carryItem: string;
  dropItem: string;
  farmerAlert: string;
  farmerPatrolling: string;
  keysStolen: string;
  powerCut: string;
  barnEscape: string;
  escapedSuccess: string;
  busted: string;
  playAgain: string;
}

export const ACT_NATURAL_TRANSLATIONS: Localized<ActNaturalTranslation> = {
  en: {
    suspiciousPartyGame: 'A VERY SUSPICIOUS PARTY GAME',
    createFarm: 'Create a farm',
    joinCode: 'Join with a room code',
    soloPractice: 'Solo practice · outsmart the computer',
    cowHeist: 'SECRET COW HEIST',
    grazeDisguise: 'Graze Disguise Meter',
    blendIn: 'Act Natural / Blend In',
    graze: 'Graze Grass [HOLD SPACE]',
    carryItem: 'Carry Key Item',
    dropItem: 'Drop Item',
    farmerAlert: '⚠️ FARMER LOOKING! ACT NATURAL!',
    farmerPatrolling: 'Farmer is patrolling the pasture...',
    keysStolen: 'Tractor Keys Swiped',
    powerCut: 'Electric Fence Power Cut',
    barnEscape: 'Barn Doors Unlocked',
    escapedSuccess: 'HERD ESCAPED TO FREEDOM! 🐮',
    busted: 'BUSTED BY THE FARMER! 🚜',
    playAgain: 'Play Again',
  },
  de: {
    suspiciousPartyGame: 'EIN SEHR VERDÄCHTIGES PARTYSPIEL',
    createFarm: 'Hof erstellen',
    joinCode: 'Mit Raumcode beitreten',
    soloPractice: 'Solo-Übung · Computer austricksen',
    cowHeist: 'GEHEIME KUH-MISSION',
    grazeDisguise: 'Gras-Tarnanzeige',
    blendIn: 'Unauffällig bleiben',
    graze: 'Gras fressen [LEERTASTE]',
    carryItem: 'Gegenstand tragen',
    dropItem: 'Fallenlassen',
    farmerAlert: '⚠️ BAUER SCHAUT HIN! UNGELOGEN GRASEN!',
    farmerPatrolling: 'Der Bauer patrouilliert über die Weide...',
    keysStolen: 'Traktorschlüssel gemopst',
    powerCut: 'Elektrozaun abgeschaltet',
    barnEscape: 'Scheunentor entriegelt',
    escapedSuccess: 'HERDE ERFOLGREICH ENTKOMMEN! 🐮',
    busted: 'VOM BAUERN ERWISCHT! 🚜',
    playAgain: 'Nochmal spielen',
  },
};
