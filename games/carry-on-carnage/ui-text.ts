import type { Localized } from '../../shared/language/types';
import { ITEM_CONFIGS, type CarryOnEvent, type ItemKind } from './types';

export const CARRY_ON_UI: Localized<{
  help: string;
  intro: string;
  steps: string[];
  movement: string;
  team: string;
  fees: string;
  play: string;
  move: string;
  joystick: string;
  closed: string;
}> = {
  en: {
    help: 'How to play',
    intro:
      'Pack four carry-ons before the three-minute boarding clock runs out. You are the traveler with the gold ring.',
    steps: [
      'Move beside a loose item and choose Grab Item (E). Move beside an open bag and choose Pack into Bag (E).',
      'Choose Sit & Compress (R). Once compressed, press Pull Zipper (F) three times. If it jams, remove an item (E).',
      'Hop off (R), pick up the zipped suitcase (E), then carry it to the metal sizer at the right-hand gate and choose Insert in Sizer (E).',
    ],
    movement:
      'Move: WASD / arrow keys, or drag the movement pad. Release to stop. Drop: Q.',
    team: 'Two bot crewmates help with three bags. Finish the last bag yourself. The gold ring marks you.',
    fees: 'Each rejected sizing attempt costs $150. Each unapproved bag costs another $150 at departure. Solo play pauses while dialogs are open.',
    play: 'Ready — play',
    move: 'MOVE',
    joystick: 'Movement joystick. Drag or use arrow keys; release to stop.',
    closed: 'DEPARTED · GATE CLOSED',
  },
  de: {
    help: 'So wird gespielt',
    intro:
      'Packe vier Koffer, bevor die drei Minuten ablaufen. Dein Reisender hat einen goldenen Ring.',
    steps: [
      'Gehe zu einem losen Gegenstand und wähle Greifen (E). Gehe zu einem offenen Koffer und wähle In Koffer packen (E).',
      'Wähle Draufsetzen & Pressen (R). Drücke nach dem Komprimieren dreimal Reissverschluss zu (F). Klemmt er, nimm einen Gegenstand heraus (E).',
      'Steige ab (R), hebe den geschlossenen Koffer auf (E) und trage ihn zur Metall-Prüfbox am rechten Gate. Wähle In Prüfbox stecken (E).',
    ],
    movement:
      'Bewegen: WASD / Pfeiltasten oder das Steuerfeld ziehen. Loslassen zum Stoppen. Fallenlassen: Q.',
    team: 'Zwei Bots helfen mit drei Koffern. Den letzten erledigst du. Der goldene Ring markiert dich.',
    fees: 'Jeder abgelehnte Prüfvorgang kostet 150 $. Bei Abflug kostet jeder nicht genehmigte Koffer weitere 150 $. Dialoge pausieren das Solospiel.',
    play: 'Bereit — spielen',
    move: 'GEHEN',
    joystick:
      'Bewegungssteuerung. Ziehen oder Pfeiltasten verwenden; loslassen zum Stoppen.',
    closed: 'ABGEFLOGEN · GATE ZU',
  },
};

const germanItems: Record<ItemKind, string> = {
  clothes: 'Hawaiihemden',
  duck: 'Riesen-Gummiente',
  flamingo: 'aufblasbarer Flamingo',
  racket: 'Tennisschläger',
  shoes: 'Alufolienschuhe',
  lobster: 'lebender Hummer',
  shampoo: 'Riesen-Shampoo',
  snowglobe: 'große Schneekugel',
};

/** Semantic event metadata keeps notifications independent of simulation prose. */
export function eventMessage(event: CarryOnEvent, language: string): string {
  const de = language === 'de';
  const item = event.item
    ? de
      ? germanItems[event.item]
      : ITEM_CONFIGS[event.item].name
    : de
      ? 'Gegenstand'
      : 'Item';
  switch (event.type) {
    case 'pack':
      switch (event.detail) {
        case 'boarding':
          return de
            ? 'Boarding! Packt vier Koffer und prüft sie in der Metallbox.'
            : 'Now boarding! Pack four bags and approve them in the metal sizer.';
        case 'packed':
          return de ? `${item} eingepackt!` : `Packed ${item}!`;
        case 'unpacked':
          return de ? `${item} herausgenommen!` : `Removed ${item}!`;
        case 'inserted':
          return de
            ? 'Koffer in der Prüfbox. Wird gemessen …'
            : 'Bag in the sizer. Measuring …';
      }
      return de ? 'Gepäck aktualisiert.' : 'Baggage updated.';
    case 'compress':
      return de
        ? 'Koffer wird zusammengedrückt. Ziehe den Reissverschluss zu.'
        : 'Compressing bag. Pull the zipper when ready.';
    case 'zip':
      if (event.detail === 'closed')
        return de
          ? 'Reissverschluss zu! Absteigen und zur Prüfbox tragen.'
          : 'Zipper closed! Hop off and carry the bag to the sizer.';
      if (event.detail === 'jammed')
        return de
          ? 'Reissverschluss klemmt! Draufsetzen oder einen Gegenstand herausnehmen.'
          : 'Zipper jammed! Sit on the bag or remove an item.';
      return de
        ? 'Reissverschluss wird geschlossen. Weiter ziehen!'
        : 'Zipping — pull again to finish!';
    case 'burst':
      return de
        ? 'Koffer geplatzt! Gegenstände aufsammeln und neu packen.'
        : 'Bag burst! Gather the items and repack.';
    case 'tsa_alarm':
      return de
        ? 'Alarm! Alufolienschuhe lenken die Wachen ab.'
        : 'Alarm! Tin foil shoes distracted the guards.';
    case 'tsa_distracted':
      return de
        ? 'An der abgelenkten Sicherheitskontrolle vorbeigeschlichen!'
        : 'Sneaked past the distracted security guard!';
    case 'tsa_caught':
      return de
        ? 'Schmuggelgut von der Sicherheitskontrolle beschlagnahmt!'
        : 'Security confiscated the contraband!';
    case 'sizer_passed':
      return de
        ? 'Gepäck genehmigt! +500 Punkte.'
        : 'Baggage approved! +500 points.';
    case 'sizer_rejected':
      return de
        ? 'Abgelehnt! Koffer schließen und komprimieren. 150 $ Gebühr.'
        : 'Rejected! Close and compress the bag. $150 fee.';
    case 'flight_departed':
      return de
        ? 'Flugzeug abgeflogen! Das Gate ist geschlossen.'
        : 'Flight departed! The gate is closed.';
  }
}
