import type { Localized } from '../../shared/language/types';

export interface SiegeAndDesistTranslation {
  medievalSiege: string;
  classicSiege: string;
  castleClash: string;
  winchCounterweight: string;
  fetchAmmo: string;
  aimSwing: string;
  pullLever: string;
  rideSling: string;
  reviveCrew: string;
  bannerCollapsed: string;
  keepDefended: string;
  playAgain: string;
}

export const SIEGE_AND_DESIST_TRANSLATIONS: Localized<SiegeAndDesistTranslation> =
  {
    en: {
      medievalSiege: 'COOPERATIVE TREBUCHET CHAOS',
      classicSiege: 'Classic Siege (Co-op vs Keep)',
      castleClash: '2v2 Castle Clash',
      winchCounterweight: 'Crank Winch [HOLD SPACE]',
      fetchAmmo: 'Load Boulder / Ammo [E]',
      aimSwing: 'Traverse Aim [A / D]',
      pullLever: 'FIRE TREBUCHET! [SPACE]',
      rideSling: 'Climb into Sling [C]',
      reviveCrew: 'Revive Crewmate [F]',
      bannerCollapsed: 'ROYAL BANNER TOPPLED! VICTORY! 🏰',
      keepDefended: 'KEEP DEFENDED! SIEGE FAILED! 🛡️',
      playAgain: 'Lay Siege Again',
    },
    de: {
      medievalSiege: 'KOOPERATIVES TRIBUTSCHET-CHAOS',
      classicSiege: 'Klassische Belagerung (Koop)',
      castleClash: '2v2 Burg-Duell',
      winchCounterweight: 'Gegengewicht kurbeln [LEERTASTE]',
      fetchAmmo: 'Geschoss laden [E]',
      aimSwing: 'Ausrichten [A / D]',
      pullLever: 'FEUER FREI! [LEERTASTE]',
      rideSling: 'In Schleuder klettern [C]',
      reviveCrew: 'Kamerad aufhelfen [F]',
      bannerCollapsed: 'BURGBANNER GESTÜRZT! SIEG! 🏰',
      keepDefended: 'BURG VERTEIDIGT! BELAGERUNG GESCHEITERT! 🛡️',
      playAgain: 'Erneut belagern',
    },
  };
