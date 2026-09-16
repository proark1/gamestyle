import type { Localized } from '../../shared/language/types';

export interface UphillDeliveryTranslation {
  movingDisaster: string;
  fourFriends: string;
  createCrew: string;
  joinCode: string;
  trySolo: string;
  progressTitle: string;
  goatAlert: string;
  couchCarry: string;
  couchDrop: string;
  couchCatch: string;
  deliveredSuccess: string;
  sofaFell: string;
  playAgain: string;
}

export const UPHILL_DELIVERY_TRANSLATIONS: Localized<UphillDeliveryTranslation> =
  {
    en: {
      movingDisaster: 'A CO-OP MOVING DISASTER',
      fourFriends: 'Four friends. One sofa. No elevator.',
      createCrew: 'Get the crew together',
      joinCode: 'Join a crew',
      trySolo: 'Try it solo',
      progressTitle: 'Mountain Ascent',
      goatAlert: '⚠️ RAMMING GOAT ON CLIFFSIDE! DUCK!',
      couchCarry: 'Lift & Carry Sofa',
      couchDrop: 'Drop Couch',
      couchCatch: 'Catch Sofa',
      deliveredSuccess: 'SOFA DELIVERED TO THE SUMMIT! 🛋️',
      sofaFell: 'SOFA PLUMMETED OFF THE CLIFF! 💥',
      playAgain: 'Deliver Again',
    },
    de: {
      movingDisaster: 'EIN KOOPERATIVER UMZUGSALBTRAUM',
      fourFriends: 'Vier Freunde. Ein Sofa. Kein Aufzug.',
      createCrew: 'Trupp zusammenstellen',
      joinCode: 'Trupp beitreten',
      trySolo: 'Solo versuchen',
      progressTitle: 'Berg-Aufstieg',
      goatAlert: '⚠️ RAMMENDE BERGZIEGE! DUCKEN!',
      couchCarry: 'Sofa anheben & tragen',
      couchDrop: 'Sofa absetzen',
      couchCatch: 'Sofa auffangen',
      deliveredSuccess: 'SOFA ERFOLGREICH OBEN ABGELIEFERT! 🛋️',
      sofaFell: 'SOFA IN DIE SCHLUCHT GESTÜRZT! 💥',
      playAgain: 'Nochmal liefern',
    },
  };
