import type { Localized } from '../../shared/language/types';

export interface DontWakeTheGiantTranslation {
  tiptoeThieves: string;
  createCrew: string;
  joinCode: string;
  sneakSolo: string;
  giantSleepMeter: string;
  giantShifting: string;
  giantSneezeWarning: string;
  goldBanked: string;
  goldInHand: string;
  escapeDoor: string;
  creep: string;
  grabPass: string;
  rotateSpoon: string;
  tickleFoot: string;
  helpFriend: string;
  exitDoor: string;
  giantAwoke: string;
  heistSuccess: string;
  playAgain: string;
}

export const DONT_WAKE_THE_GIANT_TRANSLATIONS: Localized<DontWakeTheGiantTranslation> =
  {
    en: {
      tiptoeThieves: 'TIPTOE THIEVES',
      createCrew: 'Create a crew',
      joinCode: 'Join with a code',
      sneakSolo: 'Sneak in solo',
      giantSleepMeter: 'Giant Sleep Depth',
      giantShifting: '⚠️ Giant is stirring in his sleep!',
      giantSneezeWarning: '💥 GIANT SNEEZE INCOMING! HOLD TIGHT!',
      goldBanked: 'Gold Stashed in Sack',
      goldInHand: 'Gold in Hand',
      escapeDoor: 'Keyhole Exit Door',
      creep: 'Creep Softly',
      grabPass: 'Grab / Pass Trinket',
      rotateSpoon: 'Rotate Spoon Bridge',
      tickleFoot: 'Tickle Giant Foot (Distraction)',
      helpFriend: 'Help Dazed Thief',
      exitDoor: 'Slip Through Door',
      giantAwoke: 'THE GIANT WOKE UP! SQUASHED! 🦶',
      heistSuccess: 'HEIST COMPLETE! RICH BEYOND DREAMS! 💰',
      playAgain: 'Play Again',
    },
    de: {
      tiptoeThieves: 'LEISE LEICHTFÜSSIG',
      createCrew: 'Trupp gründen',
      joinCode: 'Mit Code beitreten',
      sneakSolo: 'Solo reinschleichen',
      giantSleepMeter: 'Schlaftiefe des Riesen',
      giantShifting: '⚠️ Der Riese wälzt sich im Schlaf!',
      giantSneezeWarning: '💥 DER RIESE NIESST GLEICH! FESTHALTEN!',
      goldBanked: 'Gold im Beutel gebunkert',
      goldInHand: 'Gold in der Hand',
      escapeDoor: 'Schlüsselloch-Ausgang',
      creep: 'Auf Zehenspitzen schleichen',
      grabPass: 'Schatz greifen / übergeben',
      rotateSpoon: 'Löffelbrücke drehen',
      tickleFoot: 'Am Fuß kitzeln (Ablenkung)',
      helpFriend: 'Benommenem Dieb aufhelfen',
      exitDoor: 'Durchs Schlüsselloch entkommen',
      giantAwoke: 'DER RIESE IST AUFGEWACHT! PLATTGEMACHT! 🦶',
      heistSuccess: 'RAUB ERFOLGREICH! STEINREICH ENTFLOHEN! 💰',
      playAgain: 'Nochmal spielen',
    },
  };
