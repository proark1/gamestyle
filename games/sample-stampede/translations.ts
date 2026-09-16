import type { Localized } from '../../shared/language/types';

export interface SampleStampedeTranslation {
  aisleRadar: string;
  speedUnit: string;
  casterWobble: string;
  nitrous: string;
  drift: string;
  grab: string;
  muteAudio: string;
  unmuteAudio: string;
  rules: string;
  restartDerby: string;
  rulesTitle: string;
  rulesWelcome: string;
  rulesDriftingTitle: string;
  rulesDriftingDesc: string;
  rulesSampleTitle: string;
  rulesSampleDesc: string;
  rulesGrabberTitle: string;
  rulesGrabberDesc: string;
  rulesReceiptTitle: string;
  rulesReceiptDesc: string;
  letsShop: string;
  storeClosed: string;
  redWinsDerby: string;
  blueWinsDerby: string;
  redTeam: string;
  blueTeam: string;
  playAgain: string;
}

export const SAMPLE_STAMPEDE_TRANSLATIONS: Localized<SampleStampedeTranslation> =
  {
    en: {
      aisleRadar: 'AISLE RADAR',
      speedUnit: 'MPH',
      casterWobble: 'CASTER WOBBLE',
      nitrous: 'NITROUS',
      drift: 'DRIFT [SHIFT]',
      grab: 'GRAB / SWAT [SPACE]',
      muteAudio: 'Mute Audio',
      unmuteAudio: 'Unmute Audio',
      rules: 'Game Rules',
      restartDerby: 'Restart Derby',
      rulesTitle: 'BULK CLUB DERBY',
      rulesWelcome: 'Welcome to the wholesale warehouse shopping derby!',
      rulesDriftingTitle: '🛒 Squeaky-Wheel Drifting:',
      rulesDriftingDesc:
        'Your front-left caster wobbles and pulls hard to the left. The more giant 50lb kibble bags and 80-pack sodas you pack, the more momentum your cart carries into long drift slides!',
      rulesSampleTitle: '🥨 Free Sample Frenzy:',
      rulesSampleDesc:
        'When the store bell dings, race to the active kiosk for a nitrous sugar rush speed boost! Watch out for slippery paper plates on the floor.',
      rulesGrabberTitle: '🧲 Grabber Pole:',
      rulesGrabberDesc:
        'Press SPACE or E to snag items off shelves, swat rival carts, or tumble cereal towers!',
      rulesReceiptTitle: '🧾 Exit Receipt Gauntlet:',
      rulesReceiptDesc:
        'Check out at the front exit with your shopping list complete. If someone tosses an unauthorized 10-foot giant teddy into your cart, you get REJECTED!',
      letsShop: 'LET’S SHOP!',
      storeClosed: 'STORE CLOSED!',
      redWinsDerby: 'RED TEAM WINS THE BULK DERBY!',
      blueWinsDerby: 'BLUE TEAM WINS THE BULK DERBY!',
      redTeam: 'RED TEAM',
      blueTeam: 'BLUE TEAM',
      playAgain: 'PLAY AGAIN',
    },
    de: {
      aisleRadar: 'GANG-RADAR',
      speedUnit: 'KM/H',
      casterWobble: 'RAD-FLATTERN',
      nitrous: 'ZUCKERSCHOCK',
      drift: 'DRIFT [SHIFT]',
      grab: 'GREIFEN [LEERTASTE]',
      muteAudio: 'Ton aus',
      unmuteAudio: 'Ton an',
      rules: 'Spielregeln',
      restartDerby: 'Derby neustarten',
      rulesTitle: 'GROSSMARKT DERBY',
      rulesWelcome: 'Willkommen zum Großmarkt-Einkaufswagen-Derby!',
      rulesDriftingTitle: '🛒 Flatterrad-Driften:',
      rulesDriftingDesc:
        'Dein linkes Vorderrad flattert und zieht nach links. Je mehr 25kg-Hundefuttersäcke und 80er-Dosenpackungen du einlädst, desto weiter driftet dein Wagen!',
      rulesSampleTitle: '🥨 Gratis-Probierstände:',
      rulesSampleDesc:
        'Wenn die Marktglocke läutet, rase zum Stand für einen Zuckerschock-Turbo! Vorsicht vor rutschigen Papptellern auf dem Boden.',
      rulesGrabberTitle: '🧲 Greifarm-Stange:',
      rulesGrabberDesc:
        'Drücke LEERTASTE oder E, um Waren aus Regalen zu schnappen, Rivalen wegzustoßen oder Müsli-Türme umzukippen!',
      rulesReceiptTitle: '🧾 Kassen-Kontrolle:',
      rulesReceiptDesc:
        'Fahre mit vollständiger Einkaufsliste zur Kasse. Wenn dir jemand einen unerlaubten 3-Meter-Riesen-Teddy in den Wagen wirft, wirst du ABGEWIESEN!',
      letsShop: 'AUF ZUM EINKAUF!',
      storeClosed: 'LADENSCHLUSS!',
      redWinsDerby: 'TEAM ROT GEWINNT DAS DERBY!',
      blueWinsDerby: 'TEAM BLAU GEWINNT DAS DERBY!',
      redTeam: 'TEAM ROT',
      blueTeam: 'TEAM BLAU',
      playAgain: 'NOCHMAL SPIELEN',
    },
  };
