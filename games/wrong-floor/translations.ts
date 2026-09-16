import type { Localized } from '../../shared/language/types';

export interface WrongFloorTranslation {
  elevatorMystery: string;
  hotelFloor: string;
  voteAdvance: string;
  voteRetreat: string;
  anomalyFound: string;
  floorNormal: string;
  crewFindings: string;
  escapeRun: string;
  createParty: string;
  joinCode: string;
  soloRun: string;
  playAgain: string;
}

export const WRONG_FLOOR_TRANSLATIONS: Localized<WrongFloorTranslation> = {
  en: {
    elevatorMystery: 'THE HOTEL ANOMALY CO-OP',
    hotelFloor: 'Floor Stop',
    voteAdvance: 'Vote Advance (1)',
    voteRetreat: 'Vote Retreat (2)',
    anomalyFound: '⚠️ Anomaly Detected! Something is wrong here!',
    floorNormal: 'Floor appears clear and ordinary.',
    crewFindings: 'Crew Inspection Findings',
    escapeRun: 'EMERGENCY ESCAPE RUN!',
    createParty: 'Call the elevator',
    joinCode: 'Join guest party',
    soloRun: 'Solo inspection',
    playAgain: 'Ride Elevator Again',
  },
  de: {
    elevatorMystery: 'DAS HOTEL-ANOMALIE-KOOP',
    hotelFloor: 'Etagenhalt',
    voteAdvance: 'Weiterfahren (1)',
    voteRetreat: 'Rückzug (2)',
    anomalyFound: '⚠️ Anomalie entdeckt! Hier stimmt etwas nicht!',
    floorNormal: 'Etage wirkt gewöhnlich und sicher.',
    crewFindings: 'Untersuchungsergebnisse',
    escapeRun: 'NOTFALL-FLUCHT!',
    createParty: 'Aufzug rufen',
    joinCode: 'Gästegruppe beitreten',
    soloRun: 'Solo-Erkundung',
    playAgain: 'Nochmal Aufzug fahren',
  },
};
