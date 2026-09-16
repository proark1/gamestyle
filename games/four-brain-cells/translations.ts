import type { Localized } from '../../shared/language/types';

export interface FourBrainCellsTranslation {
  tagline: string;
  breakfastKitchen: string;
  startKitchen: string;
  joinFriends: string;
  soloNpcs: string;
  firstAssignment: string;
  howHardBreakfast: string;
  tableOne: string;
  breakfastPlease: string;
  pancakes: string;
  coffee: string;
  ordersServed: string;
  limbControls: string;
  moveLimb: string;
  raiseHand: string;
  lowerHand: string;
  grabRelease: string;
  cookPourKick: string;
  centerLimb: string;
  selectLimb: string;
  timeRemaining: string;
  shiftOver: string;
  breakfastDelivered: string;
  disasterKitchen: string;
  playAgain: string;
  soloPractice: string;
}

export const FOUR_BRAIN_CELLS_TRANSLATIONS: Localized<FourBrainCellsTranslation> =
  {
    en: {
      tagline: 'Four players control one body in a chaotic breakfast rush',
      breakfastKitchen: 'BREAKFAST KITCHEN',
      startKitchen: 'Start a kitchen',
      joinFriends: 'Join friends',
      soloNpcs: 'Solo / NPCs',
      firstAssignment: 'FIRST ASSIGNMENT',
      howHardBreakfast: 'How hard can breakfast be?',
      tableOne: 'TABLE ONE',
      breakfastPlease: 'Breakfast, please.',
      pancakes: 'pancakes',
      coffee: 'coffee',
      ordersServed: 'Orders Served',
      limbControls: 'Limb Controls',
      moveLimb: 'Move Limb',
      raiseHand: 'Raise Hand',
      lowerHand: 'Lower Hand',
      grabRelease: 'Grab / Release',
      cookPourKick: 'Cook / Pour / Kick',
      centerLimb: 'Center Limb',
      selectLimb: 'Select Limb (1–4)',
      timeRemaining: 'Time Remaining',
      shiftOver: 'SHIFT COMPLETE!',
      breakfastDelivered: 'Breakfast successfully plated and served!',
      disasterKitchen: 'Kitchen in utter chaos! Orders ruined!',
      playAgain: 'Play Again',
      soloPractice: 'Solo Kitchen Run',
    },
    de: {
      tagline:
        'Vier Spieler steuern einen Körper im chaotischen Frühstücks-Ansturm',
      breakfastKitchen: 'FRÜHSTÜCKS-KÜCHE',
      startKitchen: 'Küche eröffnen',
      joinFriends: 'Freunden beitreten',
      soloNpcs: 'Solo / NPCs',
      firstAssignment: 'ERSTE AUFGABE',
      howHardBreakfast: 'Wie schwer kann Frühstück schon sein?',
      tableOne: 'TISCH EINS',
      breakfastPlease: 'Frühstück, bitte.',
      pancakes: 'Pfannkuchen',
      coffee: 'Kaffee',
      ordersServed: 'Bestellungen serviert',
      limbControls: 'Gliedmaßen-Steuerung',
      moveLimb: 'Gliedmaße bewegen',
      raiseHand: 'Hand heben',
      lowerHand: 'Hand senken',
      grabRelease: 'Greifen / Loslassen',
      cookPourKick: 'Braten / Schenken / Kicken',
      centerLimb: 'Zentrieren',
      selectLimb: 'Gliedmaße wählen (1–4)',
      timeRemaining: 'Verbleibende Zeit',
      shiftOver: 'SCHICHT BEENDET!',
      breakfastDelivered: 'Frühstück serviert und Chaos überlebt!',
      disasterKitchen: 'Totales Küchenchaos! Bestellungen ruiniert!',
      playAgain: 'Nochmal spielen',
      soloPractice: 'Solo-Küchenrunde',
    },
  };
