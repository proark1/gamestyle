import type { Localized } from '../language/types';

interface ClubhouseCopy {
  welcome: string;
  welcomeBack: string;
  heroTop: string;
  heroPersonal: string;
  heroBottom: string;
  intro: string;
  introPersonal: string;
  signedInNote: string;
  pick: string;
  party: string;
  bubble: string;
  crew: string;
  how: string;
  steps: { title: string; text: string }[];
  partyTitle: string;
  partyText: string;
  shelf: string;
  shelfPersonal: string;
  continueLabel: string;
  continueDevice: string;
  continueAction: string;
  shelfHint: string;
  signIn: string;
  code: string;
  account: string;
  wardrobe: string;
  partyEntry: string;
  partyWaiting: string;
  partyReady: string;
  joinTitle: string;
  codeTitle: string;
  signInHint: string;
  email: string;
  send: string;
  sending: string;
  google: string;
  waiting: string;
  codeLabel: string;
  checking: string;
  confirm: string;
  different: string;
  resend: string;
  sentBefore: string;
  sentAfter: string;
  guest: string;
  or: string;
  close: string;
  privacy: string;
  privacyNote: string;
  accountLabel: string;
  wardrobeLabel: string;
  genericError: string;
  googleError: string;
}

export const CLUBHOUSE_COPY: Localized<ClubhouseCopy> = {
  en: {
    welcome: 'WELCOME TO THE YARD',
    welcomeBack: 'WELCOME BACK TO THE YARD',
    heroTop: 'Little games.',
    heroPersonal: 'Hey, {name}.',
    heroBottom: 'Big chaos.',
    intro:
      'A whole playground of wonderfully silly challenges. Grab your friends, pick a game, and see what happens.',
    introPersonal:
      'Your next round is ready. Pick up where you left off, collect another stamp, or bring your crew into party mode.',
    signedInNote: 'Your look and account are ready whenever you are.',
    pick: 'Pick a game',
    party: 'Play party mode',
    bubble: 'You bring the friends. We’ll bring the chaos.',
    crew: 'YOUR CREW IS WAITING',
    how: 'From “hey” to “one more round”.',
    steps: [
      {
        title: 'Find your kind of chaos',
        text: 'Pick a game below. No download. Jump straight in.',
      },
      {
        title: 'Make room for your friends',
        text: 'Create a room and share its code. Your crew joins you there.',
      },
      {
        title: 'Play. Laugh. Repeat.',
        text: 'Work together, compete, and find your next favourite.',
      },
    ],
    partyTitle: 'One crew. A whole party.',
    partyText:
      'Gather in a room, take on a mix of mini-games, and chase the tournament crown.',
    shelf: 'What are we playing?',
    shelfPersonal: 'Your next game',
    continueLabel: 'PICK UP WHERE YOU LEFT OFF',
    continueDevice: 'Last visited on this device',
    continueAction: 'Play again',
    shelfHint: 'Pick any adventure. We’ll meet you there!',
    signIn: 'Come on in! New here? Your first sign-in creates your account.',
    code: 'Check your inbox! Pop your six-digit code in below.',
    account: 'You’re part of the crew! Make yourself at home.',
    wardrobe: 'Looking good! Try a new outfit and make it yours.',
    partyEntry:
      'Starting the party? Create a room. Got a code? Join your friends!',
    partyWaiting:
      'Share the room code, then mark yourself ready when you’re set.',
    partyReady: 'You’re ready! Waiting for the rest of the crew and the host.',
    joinTitle: 'Join the crew',
    codeTitle: 'Your invitation is here',
    signInHint:
      'Sign in or create an account with Google or an email code. You can also keep playing as a guest.',
    email: 'Email address',
    send: 'Email me a code',
    sending: 'Sending…',
    google: 'Continue with Google',
    waiting: 'Waiting for Google…',
    codeLabel: '6-digit code',
    checking: 'Checking…',
    confirm: 'Sign in',
    different: 'Use a different email',
    resend: 'Send a new code',
    sentBefore: 'We sent a code to',
    sentAfter: 'It works for 10 minutes.',
    guest: 'Keep playing as a guest',
    or: 'or',
    close: 'Close',
    privacy: 'Privacy',
    privacyNote: 'We keep only what’s needed to sign you in.',
    accountLabel: 'Your account',
    wardrobeLabel: 'Your look',
    genericError: 'Something went wrong. Please try again.',
    googleError: 'Google sign-in didn’t finish. Please try again.',
  },
  de: {
    welcome: 'WILLKOMMEN AUF DER SPIELWIESE',
    welcomeBack: 'WILLKOMMEN ZURÜCK AUF DER SPIELWIESE',
    heroTop: 'Kleine Spiele.',
    heroPersonal: 'Hey, {name}.',
    heroBottom: 'Großes Chaos.',
    intro:
      'Eine ganze Spielwiese voller herrlich verrückter Herausforderungen. Schnapp dir deine Freunde, wählt ein Spiel und legt los.',
    introPersonal:
      'Deine nächste Runde wartet. Spiel dort weiter, wo du aufgehört hast, sammle einen neuen Stempel oder starte den Party-Modus mit deiner Crew.',
    signedInNote: 'Dein Look und dein Konto sind bereit.',
    pick: 'Spiel wählen',
    party: 'Party-Modus spielen',
    bubble: 'Du bringst die Freunde. Wir bringen das Chaos.',
    crew: 'DEINE CREW WARTET',
    how: 'Von „Hey“ zu „Noch eine Runde“.',
    steps: [
      {
        title: 'Finde dein Lieblingschaos',
        text: 'Wähle unten ein Spiel. Kein Download. Einfach loslegen.',
      },
      {
        title: 'Hol deine Freunde dazu',
        text: 'Erstelle einen Raum und teile den Code. Deine Crew kommt dazu.',
      },
      {
        title: 'Spielen. Lachen. Nochmal.',
        text: 'Spielt zusammen, tretet gegeneinander an und findet euren nächsten Favoriten.',
      },
    ],
    partyTitle: 'Eine Crew. Eine große Party.',
    partyText:
      'Trefft euch im Raum, spielt einen Mix aus Minispielen und holt euch die Turnierkrone.',
    shelf: 'Was spielen wir?',
    shelfPersonal: 'Dein nächstes Spiel',
    continueLabel: 'SPIEL EINFACH WEITER',
    continueDevice: 'Zuletzt auf diesem Gerät besucht',
    continueAction: 'Noch mal spielen',
    shelfHint: 'Wähle ein Abenteuer. Wir sehen uns dort!',
    signIn: 'Komm rein! Neu hier? Beim ersten Anmelden entsteht dein Konto.',
    code: 'Schau ins Postfach! Gib unten deinen sechsstelligen Code ein.',
    account: 'Du gehörst zur Crew! Mach es dir gemütlich.',
    wardrobe: 'Steht dir! Probiere ein neues Outfit und finde deinen Look.',
    partyEntry:
      'Du startest die Party? Erstelle einen Raum. Schon einen Code? Tritt deinen Freunden bei!',
    partyWaiting:
      'Teile den Raumcode und markiere dich als bereit, wenn es losgehen kann.',
    partyReady: 'Du bist bereit! Jetzt fehlen noch die Crew und der Gastgeber.',
    joinTitle: 'Werde Teil der Crew',
    codeTitle: 'Deine Einladung ist da',
    signInHint:
      'Mit Google oder einem E-Mail-Code anmelden oder ein Konto erstellen. Als Gast kannst du auch weiterspielen.',
    email: 'E-Mail-Adresse',
    send: 'Code per E-Mail senden',
    sending: 'Wird gesendet…',
    google: 'Mit Google fortfahren',
    waiting: 'Warten auf Google…',
    codeLabel: '6-stelliger Code',
    checking: 'Wird geprüft…',
    confirm: 'Anmelden',
    different: 'Andere E-Mail verwenden',
    resend: 'Neuen Code senden',
    sentBefore: 'Wir haben einen Code gesendet an',
    sentAfter: 'Er ist 10 Minuten gültig.',
    guest: 'Als Gast weiterspielen',
    or: 'oder',
    close: 'Schließen',
    privacy: 'Datenschutz',
    privacyNote: 'Wir speichern nur, was für deine Anmeldung nötig ist.',
    accountLabel: 'Dein Konto',
    wardrobeLabel: 'Dein Look',
    genericError: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
    googleError:
      'Die Google-Anmeldung wurde nicht abgeschlossen. Bitte versuche es erneut.',
  },
};
