import type { Localized } from '../../shared/language/types';

export interface ShelfControlTranslation {
  propHunt: string;
  guardRole: string;
  mannequinRole: string;
  hidingPhase: string;
  huntPhase: string;
  inspectAction: string;
  poseAction: string;
  securitySwitch: string;
  escapedSuccess: string;
  caughtEnd: string;
  playAgain: string;
}

export const SHELF_CONTROL_TRANSLATIONS: Localized<ShelfControlTranslation> = {
  en: {
    propHunt: 'AFTER-HOURS DEPARTMENT STORE SHOWDOWN',
    guardRole: 'Night Security Guard',
    mannequinRole: 'Living Mannequin',
    hidingPhase: 'Hiding Phase: Find your pose!',
    huntPhase: 'Hunt Phase: Catch moving mannequins!',
    inspectAction: 'Inspect (E)',
    poseAction: 'Freeze Pose (Space)',
    securitySwitch: 'Security breaker flipped!',
    escapedSuccess: 'MANNEQUINS ESCAPED INTO THE NIGHT! 🏃',
    caughtEnd: 'ALL MANNEQUINS BUSTED & TAGGED! 🚨',
    playAgain: 'Play Again',
  },
  de: {
    propHunt: 'NACHT-DUELL IM KAUFHAUS',
    guardRole: 'Nachtwächter',
    mannequinRole: 'Lebendige Schaufensterpuppe',
    hidingPhase: 'Versteckphase: Finde deine Pose!',
    huntPhase: 'Jagdphase: Entlarve bewegte Puppen!',
    inspectAction: 'Prüfen (E)',
    poseAction: 'Pose einfrieren (Leertaste)',
    securitySwitch: 'Hauptschalter umgelegt!',
    escapedSuccess: 'PUPPEN IN DIE NACHT ENTKOMMEN! 🏃',
    caughtEnd: 'ALLE PUPPEN ENTTARNT & FESTGEHALTEN! 🚨',
    playAgain: 'Nochmal spielen',
  },
};
