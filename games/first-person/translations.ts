import type { Localized } from '../../shared/language/types';

export interface FirstPersonTranslation {
  firstPersonSite: string;
  brickStack: string;
  mortarMixer: string;
  trowelTool: string;
  timberPlacement: string;
  courseCompleted: string;
  wallCollapse: string;
  playAgain: string;
}

export const FIRST_PERSON_TRANSLATIONS: Localized<FirstPersonTranslation> = {
  en: {
    firstPersonSite: 'FIRST-PERSON BRICKLAYING CRAFT',
    brickStack: 'Brick Stack',
    mortarMixer: 'Mortar Mixer',
    trowelTool: 'Leveling Trowel',
    timberPlacement: 'Timber Joists',
    courseCompleted: 'BRICK COURSE COMPLETED LEVEL! 🧱',
    wallCollapse: 'WALL COLLAPSED! LEVEL FAILED! 💥',
    playAgain: 'Lay Bricks Again',
  },
  de: {
    firstPersonSite: 'HANDWERKS-MAUERN IN DER EGOPERSPEKTIVE',
    brickStack: 'Ziegelstapel',
    mortarMixer: 'Mörtelmischer',
    trowelTool: 'Maurerkelle',
    timberPlacement: 'Holzbalken',
    courseCompleted: 'MAUERWERK SCHNURGERADE GEBAUT! 🧱',
    wallCollapse: 'MAUER EINGESTÜRZT! MANGELHAFT! 💥',
    playAgain: 'Nochmal mauern',
  },
};
