import type { Localized } from '../../shared/language/types';

export interface StackOrSinkTranslation {
  survivalTagline: string;
  createCrew: string;
  joinCode: string;
  practiceSolo: string;
  waterRising: string;
  escapePlan: string;
  salvageHeight: string;
  piecesCount: string;
  craneControls: string;
  pickUp: string;
  rotate: string;
  placeItem: string;
  climb: string;
  crewDrowned: string;
  crewEscaped: string;
  playAgain: string;
}

export const STACK_OR_SINK_TRANSLATIONS: Localized<StackOrSinkTranslation> = {
  en: {
    survivalTagline: 'CO-OP SURVIVAL · 1–4 PLAYERS',
    createCrew: 'Create a crew',
    joinCode: 'Join with a room code',
    practiceSolo: 'Try it solo',
    waterRising: 'The water’s rising.',
    escapePlan: 'Your escape plan is a pile of junk.',
    salvageHeight: 'Rescue Height',
    piecesCount: 'Salvage Pieces',
    craneControls: 'Crane Controls',
    pickUp: 'Pick Up Piece',
    rotate: 'Rotate Piece [R]',
    placeItem: 'Place Piece [SPACE]',
    climb: 'Climb Tower [W/S]',
    crewDrowned: 'CREW SWEPT AWAY! THE WATER WON! 🌊',
    crewEscaped: 'RESCUE PLATFORM REACHED! SURVIVED! 🚁',
    playAgain: 'Stack Again',
  },
  de: {
    survivalTagline: 'KOOP-ÜBERLEBEN · 1–4 SPIELER',
    createCrew: 'Trupp gründen',
    joinCode: 'Mit Raumcode beitreten',
    practiceSolo: 'Solo versuchen',
    waterRising: 'Das Wasser steigt.',
    escapePlan: 'Euer Fluchtplan ist ein Haufen Schrott.',
    salvageHeight: 'Rettungshöhe',
    piecesCount: 'Schrotteile',
    craneControls: 'Kran-Steuerung',
    pickUp: 'Teil aufheben',
    rotate: 'Teil drehen [R]',
    placeItem: 'Teil platzieren [LEERTASTE]',
    climb: 'Turm klettern [W/S]',
    crewDrowned: 'VOM WASSER WEGGESPÜLT! 🌊',
    crewEscaped: 'RETTUNGSPLATTFORM ERREICHT! ÜBERLEBT! 🚁',
    playAgain: 'Nochmal stapeln',
  },
};
