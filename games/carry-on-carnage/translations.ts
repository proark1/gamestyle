import type { Localized } from '../../shared/language/types';

export interface CarryOnCarnageTranslation {
  bagsApproved: string;
  flightToIbiza: string;
  finalCall: string;
  nowBoarding: string;
  pts: string;
  gateFees: string;
  sizerApproved: string;
  pinataBurst: string;
  fullyZippedHopOff: string;
  fullyZippedCarry: string;
  sittingCompressing: string;
  overstuffed: string;
  packMore: string;
  luggageBulge: string;
  compressionWeight: string;
  sittingCount: string;
  zipperClosure: string;
  packIntoBag: string;
  insertInSizer: string;
  removeItem: string;
  hopOffKey: string;
  pickUpSuitcase: string;
  grabItem: string;
  sitCompress: string;
  hopOff: string;
  pullZipper: string;
  dropRelease: string;
  boardingComplete: string;
  flightDeparted: string;
  successDesc: string;
  failDesc: string;
  approvedBagsStat: string;
  contrabandStat: string;
  gateFeesStat: string;
  netScoreStat: string;
  catchNextFlight: string;
}

export const CARRY_ON_TRANSLATIONS: Localized<CarryOnCarnageTranslation> = {
  en: {
    bagsApproved: 'Bags Approved:',
    flightToIbiza: 'BUDGET-AIR · FLIGHT 707 TO IBIZA',
    finalCall: 'FINAL CALL · GATE CLOSING',
    nowBoarding: 'NOW BOARDING · GATE B12',
    pts: 'PTS',
    gateFees: 'GATE FEES',
    sizerApproved: '✅ SIZER APPROVED (PASSED CAGE TEST)',
    pinataBurst: '💥 PIÑATA BURST! GATHER ITEMS & REPACK!',
    fullyZippedHopOff: '🔒 FULLY ZIPPED · HOP OFF [R] & CARRY TO SIZER',
    fullyZippedCarry: '🔒 FULLY ZIPPED · CARRY TO SIZER BOX (E)',
    sittingCompressing: '🧳 SITTING & COMPRESSING ({pct}%) · PULL ZIPPER (F)',
    overstuffed: '⚠️ OVERSTUFFED! SIT/STOMP TO COMPRESS BEFORE ZIPPING (R)',
    packMore: '🧳 PACK MORE VACATION JUNK OR PULL ZIPPER (F)',
    luggageBulge: 'Luggage Bulge & Seam Strain:',
    compressionWeight: 'Compression Weight (Sit/Stomp):',
    sittingCount: '({count} sitting)',
    zipperClosure: 'Zipper Closure:',
    packIntoBag: 'Pack into Bag',
    insertInSizer: 'Insert in Sizer',
    removeItem: 'Remove Item',
    hopOffKey: 'Hop Off (R)',
    pickUpSuitcase: 'Pick Up Suitcase',
    grabItem: 'Grab Item',
    sitCompress: 'Sit & Compress',
    hopOff: 'Hop Off',
    pullZipper: 'Pull Zipper',
    dropRelease: 'Drop / Release',
    boardingComplete: 'Boarding Complete!',
    flightDeparted: 'Flight Departed!',
    successDesc:
      'Your crew successfully squeezed and sized all carry-ons into the metal box!',
    failDesc:
      'The jetway closed! Any unapproved luggage was slapped with a $150 penalty fee.',
    approvedBagsStat: 'Approved Bags',
    contrabandStat: 'Contraband Smuggled',
    gateFeesStat: 'Gate Fees Charged',
    netScoreStat: 'Net Score',
    catchNextFlight: 'Catch Next Flight',
  },
  de: {
    bagsApproved: 'Gepäck genehmigt:',
    flightToIbiza: 'BUDGET-AIR · FLUG 707 NACH IBIZA',
    finalCall: 'LETZTER AUFRUF · GATE SCHLIESST',
    nowBoarding: 'BOARDING · GATE B12',
    pts: 'PKT',
    gateFees: 'GATE-GEBÜHREN',
    sizerApproved: '✅ GEPÄCKMASSE EINGEHALTEN (KÄFIGTEST BESTANDEN)',
    pinataBurst: '💥 GEPLATZT! TEILE AUFSAMMELN & NEU PACKEN!',
    fullyZippedHopOff:
      '🔒 REISSVERSCHLUSS ZU · RUNTERSPRINGEN [R] & ZUR BOX TRAGEN',
    fullyZippedCarry: '🔒 REISSVERSCHLUSS ZU · ZUR PRÜFBOX TRAGEN (E)',
    sittingCompressing:
      '🧳 ZUSAMMENPRESSEN ({pct}%) · REISSVERSCHLUSS ZIEHEN (F)',
    overstuffed: '⚠️ ÜBERFÜLLT! DRAUFSETZEN ZUM KOMPRIMIEREN (R)',
    packMore: '🧳 MEHR URLAUBSKRAM PACKEN ODER ZUZIEHEN (F)',
    luggageBulge: 'Kofferbeule & Nahtspannung:',
    compressionWeight: 'Kompressionsgewicht (Sitzen/Stampfen):',
    sittingCount: '({count} sitzen)',
    zipperClosure: 'Reissverschluss:',
    packIntoBag: 'In Koffer packen',
    insertInSizer: 'In Prüfbox stecken',
    removeItem: 'Gegenstand herausnehmen',
    hopOffKey: 'Runterspringen (R)',
    pickUpSuitcase: 'Koffer aufheben',
    grabItem: 'Gegenstand greifen',
    sitCompress: 'Draufsetzen & Pressen',
    hopOff: 'Runterspringen',
    pullZipper: 'Reissverschluss zu',
    dropRelease: 'Fallenlassen',
    boardingComplete: 'Boarding abgeschlossen!',
    flightDeparted: 'Flugzeug abgeflogen!',
    successDesc:
      'Eure Crew hat jedes Handgepäckstück erfolgreich in die Box gequetscht!',
    failDesc:
      'Das Gate ist zu! Nicht genehmigtes Gepäck kostete jeweils 150 $ Strafe.',
    approvedBagsStat: 'Genehmigtes Gepäck',
    contrabandStat: 'Schmuggelgut',
    gateFeesStat: 'Gate-Gebühren',
    netScoreStat: 'Gesamtpunkte',
    catchNextFlight: 'Nächsten Flug nehmen',
  },
};
