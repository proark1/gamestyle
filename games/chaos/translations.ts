import type { Localized } from '../../shared/language/types';

export interface ChaosTranslation {
  constructionSite: string;
  blueprints: string;
  deliveryOrders: string;
  craneControls: string;
  forkliftControls: string;
  buildingPermit: string;
  inspectorApproved: string;
  inspectorRejected: string;
  playAgain: string;
}

export const CHAOS_TRANSLATIONS: Localized<ChaosTranslation> = {
  en: {
    constructionSite: 'COOPERATIVE JOB-SITE DERBY',
    blueprints: 'Architect Blueprints',
    deliveryOrders: 'Material Orders',
    craneControls: 'Site Crane',
    forkliftControls: 'Warehouse Pallet Jack',
    buildingPermit: 'Building Permit Inspection',
    inspectorApproved: 'PERMIT GRANTED! SITE APPROVED! 🏗️',
    inspectorRejected: 'PERMIT DENIED! CODE VIOLATIONS! 🛑',
    playAgain: 'Build Again',
  },
  de: {
    constructionSite: 'KOOPERATIVES BAUSTELLEN-CHAOS',
    blueprints: 'Baupläne',
    deliveryOrders: 'Materialbestellungen',
    craneControls: 'Baukran',
    forkliftControls: 'Hubwagen',
    buildingPermit: 'Bauabnahme',
    inspectorApproved: 'BAUABNAHME BESTANDEN! GENEHMIGT! 🏗️',
    inspectorRejected: 'BAUABNAHME DURCHGEFALLEN! MÄNGEL! 🛑',
    playAgain: 'Nochmal bauen',
  },
};
