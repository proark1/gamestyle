import type { Localized } from '../../shared/language/types';

export interface DriveThruTranslation {
  intercomMeltdown: string;
  orderNumber: string;
  timeLeft: string;
  score: string;
  intercomLabel: string;
  decodedLabel: string;
  driverRole: string;
  passengerRole: string;
  grillRole: string;
  baristaRole: string;
  grillPatties: string;
  flipPatty: string;
  shakePressure: string;
  ventShake: string;
  fryerTemp: string;
  liftBasket: string;
  dropBasket: string;
  reachTray: string;
  honkHorn: string;
  shortStopReach: string;
  meltdownTitle: string;
  shiftSurvived: string;
  playAgain: string;
}

export const DRIVE_THRU_TRANSLATIONS: Localized<DriveThruTranslation> = {
  en: {
    intercomMeltdown: 'THE CRACKLING INTERCOM MELTDOWN',
    orderNumber: 'ORDER #',
    timeLeft: 'TIME LEFT:',
    score: 'SCORE:',
    intercomLabel: 'INTERCOM:',
    decodedLabel: 'DECODED:',
    driverRole: 'Driver (Sedan)',
    passengerRole: 'Passenger (Reach)',
    grillRole: 'Grill Cook (Patties)',
    baristaRole: 'Barista (Drinks)',
    grillPatties: 'Grill Patties',
    flipPatty: 'Flip Patty (Space)',
    shakePressure: 'Shake Pressure',
    ventShake: 'Vent Pressure (V)',
    fryerTemp: 'Fryer Temp',
    liftBasket: 'Lift Basket (B)',
    dropBasket: 'Lower Basket (B)',
    reachTray: 'Reach for Window Tray (E)',
    honkHorn: 'Honk Horn (H)',
    shortStopReach: 'SHORT STOP REACH! EXTEND PASSENGER ARM TO GRAB TRAY!',
    meltdownTitle: 'DRIVE-THRU MELTDOWN! 💥',
    shiftSurvived: 'RUSH SURVIVED! ORDER SERVED! 🍔',
    playAgain: 'Next Car in Line',
  },
  de: {
    intercomMeltdown: 'DAS KNACKENDE SPRECHANLAGEN-CHAOS',
    orderNumber: 'BESTELLUNG #',
    timeLeft: 'ZEIT:',
    score: 'PUNKTE:',
    intercomLabel: 'SPRECHANLAGE:',
    decodedLabel: 'ENTZIFFERT:',
    driverRole: 'Fahrer (Limousine)',
    passengerRole: 'Beifahrer (Greifen)',
    grillRole: 'Grillmeister (Patties)',
    baristaRole: 'Barista (Getränke)',
    grillPatties: 'Grill-Patties',
    flipPatty: 'Patty wenden (Leertaste)',
    shakePressure: 'Shake-Druck',
    ventShake: 'Druck ablassen (V)',
    fryerTemp: 'Fritteusen-Hitze',
    liftBasket: 'Korb heben (B)',
    dropBasket: 'Korb senken (B)',
    reachTray: 'Aus dem Fenster lehnen (E)',
    honkHorn: 'Hupen (H)',
    shortStopReach: 'ZU WEIT WEG VOM FENSTER! WEIT AUS DEM FENSTER LEHNEN!',
    meltdownTitle: 'DRIVE-THRU ESKALATION! 💥',
    shiftSurvived: 'ANSTURM ÜBERSTANDEN! BESTELLUNG GELIEFERT! 🍔',
    playAgain: 'Nächstes Auto vorfahren',
  },
};
