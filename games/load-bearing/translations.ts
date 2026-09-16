import type { Localized } from '../../shared/language/types';

export interface LoadBearingTranslation {
  pianoRescue: string;
  demolitionCrew: string;
  demolitionJob: string;
  upperFloorIntegrity: string;
  pianoHealth: string;
  secondsRemaining: string;
  sledgehammer: string;
  cutSupport: string;
  pianoSaved: string;
  pianoCrushed: string;
  savedDesc: string;
  crushedDesc: string;
  startCrew: string;
  joinCode: string;
  trySolo: string;
  practiceCrew: string;
  playAgain: string;
}

export const LOAD_BEARING_TRANSLATIONS: Localized<LoadBearingTranslation> = {
  en: {
    pianoRescue: 'PIANO DEMOLITION CO-OP',
    demolitionCrew: 'Demolition Crew',
    demolitionJob: 'A THREE-MINUTE DEMOLITION JOB',
    upperFloorIntegrity: 'Upper Floor Integrity',
    pianoHealth: 'Grand Piano Health',
    secondsRemaining: 'Seconds Remaining',
    sledgehammer: 'Sledgehammer Strike',
    cutSupport: 'Cut Beam / Support',
    pianoSaved: 'PIANO SAVED! 🎹',
    pianoCrushed: 'PIANO CRUSHED! 💥',
    savedDesc:
      'The house came down, but the concert grand survived without a scratch!',
    crushedDesc:
      'Load-bearing pillars failed too early! The roof flattened the piano!',
    startCrew: 'Start a crew',
    joinCode: 'Join with a room code',
    trySolo: 'Just me? Try it solo',
    practiceCrew: 'Practice with a crew',
    playAgain: 'Play Again',
  },
  de: {
    pianoRescue: 'KLAVIER-ABBRUCH-KOOP',
    demolitionCrew: 'Abbruchtrupp',
    demolitionJob: 'EIN DREI-MINUTEN ABBRUCH-AUFTRAG',
    upperFloorIntegrity: 'Stabilität Obergeschoss',
    pianoHealth: 'Klavier-Zustand',
    secondsRemaining: 'Sekunden übrig',
    sledgehammer: 'Vorschlaghammer-Schlag',
    cutSupport: 'Balken / Stütze kappen',
    pianoSaved: 'KLAVIER GERETTET! 🎹',
    pianoCrushed: 'KLAVIER ZERQUETSCHT! 💥',
    savedDesc: 'Das Haus stürzte ein, aber der Konzertflügel blieb unversehrt!',
    crushedDesc:
      'Tragende Säulen zu früh gekappt! Das Dach hat das Klavier plattgemacht!',
    startCrew: 'Trupp gründen',
    joinCode: 'Mit Raumcode beitreten',
    trySolo: 'Nur ich? Solo versuchen',
    practiceCrew: 'Mit Trupp üben',
    playAgain: 'Nochmal spielen',
  },
};
