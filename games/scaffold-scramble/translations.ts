import type { Localized } from '../../shared/language/types';

export interface ScaffoldTranslations {
  titleMain: string;
  titleHighlight: string;
  tagline: string;
  desc: string;

  roleSelectorTitle: string;
  roleLeftWinch: string;
  roleRightWinch: string;
  roleCleaner: string;
  roleAllRounder: string;

  startShift: string;
  playAgain: string;

  hudTilt: string;
  hudCleaned: string;
  hudDeadline: string;
  hudStory: string;
  tiltWarning: string;
  slipHazard: string;

  shiftOver: string;
  ceoImpressed: string;
  ceoImpressedDesc: string;
  ceoFurious: string;
  ceoFuriousDesc: string;

  hintMove: string;
  hintWinchLeft: string;
  hintWinchRight: string;
  hintAction: string;
  hintSwitchTool: string;
  hintClimb: string;
  hintShoo: string;

  activeToolSponge: string;
  activeToolSqueegee: string;
}

export const SCAFFOLD_TRANSLATIONS: Localized<ScaffoldTranslations> = {
  en: {
    titleMain: 'Scaffold ',
    titleHighlight: 'Scramble',
    tagline: 'TWO WINCHES. 80 STORIES UP. TOTAL VERTIGO.',
    desc: 'Two manual winches suspend your cradle eighty stories in the sky. If you crank unevenly, the platform tilts violently into a slip-and-slide! Clean 30 dirty windows spotless before the CEO’s helicopter lands on the roof.',

    roleSelectorTitle: 'Select Your Crew Assignment',
    roleLeftWinch: 'Left Winch',
    roleRightWinch: 'Right Winch',
    roleCleaner: 'Window Cleaner',
    roleAllRounder: 'Solo All-Rounder',

    startShift: 'Start Window Washing Shift',
    playAgain: 'Wash Another High-Rise',

    hudTilt: 'Cradle Tilt',
    hudCleaned: 'Windows Cleaned',
    hudDeadline: 'Helicopter Landing',
    hudStory: 'Story',
    tiltWarning: 'CAUTION: TILT > 15°',
    slipHazard: 'DANGER: SLIP & SLIDE ACTIVE (> 20°)!',

    shiftOver: 'Shift Finished!',
    ceoImpressed: 'The CEO Gives a Thumbs Up!',
    ceoImpressedDesc:
      'All 30 dirty windows are sparkling spotless! The helicopter touches down smoothly on the helipad.',
    ceoFurious: 'Windows Still Filthy!',
    ceoFuriousDesc:
      'The helicopter landed on the roof while smudges and dirty grime remained on the facade!',

    hintMove: 'Walk Deck',
    hintWinchLeft: 'Left Winch (Q/Z)',
    hintWinchRight: 'Right Winch (E/R)',
    hintAction: 'Soap / Squeegee / Shoo (Space/F)',
    hintSwitchTool: 'Swap Tool (Tab/T)',
    hintClimb: 'Climb Tether (Space)',
    hintShoo: 'Shoo Cable Pigeon',

    activeToolSponge: 'Soap Sponge',
    activeToolSqueegee: 'Rubber Squeegee',
  },
  de: {
    titleMain: 'Scaffold ',
    titleHighlight: 'Scramble',
    tagline: 'ZWEI WINDEN. 80 STOCKWERKE HOCH. REINER SCHWINDEL.',
    desc: 'Zwei Handwinden tragen eure Fensterputz-Gondel im 80. Stock. Kurbelt ihr ungleichmäßig, kippt die Plattform in eine halsbrecherische Rutschbahn! Putzt 30 schmutzige Fenster blitzblank, bevor der Hubschrauber des Chefs auf dem Dach landet.',

    roleSelectorTitle: 'Wähle deine Aufgabe im Team',
    roleLeftWinch: 'Linke Winde',
    roleRightWinch: 'Rechte Winde',
    roleCleaner: 'Fensterputzer',
    roleAllRounder: 'Solo Allrounder',

    startShift: 'Schicht beginnen',
    playAgain: 'Noch ein Hochhaus putzen',

    hudTilt: 'Gondel-Neigung',
    hudCleaned: 'Saubere Fenster',
    hudDeadline: 'Helikopter-Landezeit',
    hudStory: 'Stockwerk',
    tiltWarning: 'ACHTUNG: NEIGUNG > 15°',
    slipHazard: 'GEFAHR: RUTSCHBAHN AKTIV (> 20°)!',

    shiftOver: 'Schicht beendet!',
    ceoImpressed: 'Der Chef zeigt den Daumen hoch!',
    ceoImpressedDesc:
      'Alle 30 Fenster glänzen blitzblank! Der Hubschrauber landet pünktlich auf dem Dach.',
    ceoFurious: 'Die Scheiben sind noch dreckig!',
    ceoFuriousDesc:
      'Der Hubschrauber ist gelandet, aber die Fassade war voller Schmutz und Schlieren!',

    hintMove: 'Gehen',
    hintWinchLeft: 'Linke Winde (Q/Z)',
    hintWinchRight: 'Rechte Winde (E/R)',
    hintAction: 'Einseifen / Abziehen (Leertaste/F)',
    hintSwitchTool: 'Werkzeug wechseln (Tab/T)',
    hintClimb: 'Am Seil hochklettern (Leertaste)',
    hintShoo: 'Taube verscheuchen',

    activeToolSponge: 'Seifenschwamm',
    activeToolSqueegee: 'Gummi-Abzieher',
  },
};
