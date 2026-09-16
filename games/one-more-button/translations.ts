import type { Localized } from '../../shared/language/types';

export interface OneMoreButtonTranslation {
  gameShow: string;
  headlineMain: string;
  headlineEm: string;
  subtitle: string;
  players: string;
  duration: string;
  nameLabel: string;
  namePlaceholder: string;
  createShow: string;
  joinFriends: string;
  trySolo: string;
  noDownloadNote: string;
  quoteTitle: string;
  quoteText: string;
  prizePot: string;
  presses: string;
  hazards: string;
  getOut: string;
  showTime: string;
  onStage: string;
  pressButton: string;
  shoutStop: string;
  helpFriend: string;
  cashOut: string;
  jump: string;
  camera: string;
  playAgain: string;
}

export const ONE_MORE_BUTTON_TRANSLATIONS: Localized<OneMoreButtonTranslation> =
  {
    en: {
      gameShow: 'THE JUMBLEYARD GAME SHOW',
      headlineMain: 'We were rich\nuntil ',
      headlineEm: 'you touched it.',
      subtitle:
        'One big button. Four small chances of agreeing.\nMore money. More hazards. Know when to leave.',
      players: '1–4 players',
      duration: '3-minute shows',
      nameLabel: 'Your contestant name',
      namePlaceholder: 'Definitely Not Greedy',
      createShow: 'Create a show',
      joinFriends: 'Join friends',
      trySolo: 'Try solo',
      noDownloadNote: 'No download. No actual money. Plenty of blame.',
      quoteTitle: 'THE LAST WORDS OF A RICH TEAM',
      quoteText: '“Okay, but just one more.”',
      prizePot: 'SHARED PRIZE POT',
      presses: 'presses',
      hazards: 'hazards',
      getOut: 'GET OUT!',
      showTime: 'SHOW TIME',
      onStage: 'ON STAGE',
      pressButton: 'Press Button',
      shoutStop: 'Shout STOP',
      helpFriend: 'Help Friend',
      cashOut: 'Cash Out',
      jump: 'Jump',
      camera: 'Camera',
      playAgain: 'Play Again',
    },
    de: {
      gameShow: 'DIE JUMBLEYARD GAMESHOW',
      headlineMain: 'Wir waren reich,\nbis ',
      headlineEm: 'du gedrückt hast.',
      subtitle:
        'Ein riesiger Knopf. Vier kleine Chancen auf Einigung.\nMehr Geld. Mehr Gefahren. Weiß, wann Schluss ist.',
      players: '1–4 Spieler',
      duration: '3-Minuten Shows',
      nameLabel: 'Dein Kandidatenname',
      namePlaceholder: 'Garantiert Nicht Gierig',
      createShow: 'Show erstellen',
      joinFriends: 'Freunden beitreten',
      trySolo: 'Solo üben',
      noDownloadNote:
        'Kein Download. Kein echtes Geld. Jede Menge Schuldzuweisungen.',
      quoteTitle: 'DIE LETZTEN WORTE EINES REICHEN TEAMS',
      quoteText: '„Komm, nur noch ein einziges Mal.“',
      prizePot: 'GEMEINSAMER GEWINNTOPF',
      presses: 'Drücker',
      hazards: 'Gefahren',
      getOut: 'RAUS HIER!',
      showTime: 'SHOW-ZEIT',
      onStage: 'AUF DER BÜHNE',
      pressButton: 'Knopf drücken',
      shoutStop: 'STOPP rufen',
      helpFriend: 'Freund helfen',
      cashOut: 'Auszahlen',
      jump: 'Springen',
      camera: 'Kamera',
      playAgain: 'Nochmal spielen',
    },
  };
