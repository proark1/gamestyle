import type { Localized } from '../../shared/language/types';

export interface BungeeDoublesTranslation {
  controls: string;
  move: string;
  joystick: string;
  jump: string;
  you: string;
  playerRing: string;
  helpTitle: string;
  helpMove: string;
  helpActions: string;
  helpRules: string;
  helpBungee: string;
  helpCamera: string;
  helpSwitch: string;
  close: string;
  orbitHint: string;
  red: string;
  blue: string;
  team: string;
  serving: string;
  rally: string;
  hotStreak: string;
  bungeeStrain: string;
  criticalSnap: string;
  slingshotReady: string;
  rallyUpdate: string;
  wins: string;
  matchComplete: string;
  playAgain: string;
  volley: string;
  smash: string;
  dive: string;
  switchTeam: string;
  camera: string;
  reset: string;
  touchCam: string;
  touchSmash: string;
  touchDive: string;
  touchHit: string;
}

export const BUNGEE_DOUBLES_TRANSLATIONS: Localized<BungeeDoublesTranslation> =
  {
    en: {
      controls: 'Game actions',
      move: 'MOVE',
      joystick: 'Movement joystick. Drag or use arrow keys; release to stop.',
      jump: 'Jump',
      you: 'You',
      playerRing: 'pale ring',
      helpTitle: 'How to play Bungee Doubles',
      helpMove:
        'You control the player with the pale ground ring. Move with WASD or arrow keys, or drag the left joystick on touch screens. Directions follow your camera.',
      helpActions:
        'Hit / Space serves or returns the ball. Smash / E is a power shot, Dive / Shift reaches farther, and Jump / J gives extra height. You can move and hit at the same time on touch screens.',
      helpRules:
        'First team to 7 points wins. Return the ball before its second bounce. Each team gets one hit before the opponent returns it. A floor bounce followed by a glass rebound is legal; hitting a wall before the floor or failing to cross the net loses the point.',
      helpBungee:
        'Your teammate is an NPC. Stay together: the cord pulls you back when stretched. Jump with at least 55% strain for a slingshot boost. Running into your partner can stun both players.',
      helpCamera:
        'Drag the court or use Q/R to orbit. Camera / C cycles views. The court stays in view when you rotate your phone.',
      helpSwitch:
        'Switch Team rebalances the NPCs and restarts the current point without changing the score. Reset starts a fresh match. This help screen pauses local play.',
      close: 'Back to game',
      orbitHint: 'Drag court to orbit 360°',
      red: 'Red',
      blue: 'Blue',
      team: 'Team',
      serving: 'Serving',
      rally: 'RALLY',
      hotStreak: 'HOT STREAK!',
      bungeeStrain: 'BUNGEE STRAIN',
      criticalSnap: 'CRITICAL SNAP DANGER!',
      slingshotReady: 'SLINGSHOT READY',
      rallyUpdate: 'RALLY UPDATE',
      wins: 'WINS!',
      matchComplete: 'Championship Match Complete',
      playAgain: 'Play Again',
      volley: 'Volley',
      smash: 'Smash',
      dive: 'Dive',
      switchTeam: 'Switch Team',
      camera: 'Camera',
      reset: 'Reset',
      touchCam: 'CAM',
      touchSmash: 'SMASH',
      touchDive: 'DIVE',
      touchHit: 'HIT',
    },
    de: {
      controls: 'Spielaktionen',
      move: 'BEWEGEN',
      joystick:
        'Bewegungs-Joystick. Ziehen oder Pfeiltasten nutzen; zum Stoppen loslassen.',
      jump: 'Springen',
      you: 'Du',
      playerRing: 'heller Ring',
      helpTitle: 'So spielst du Bungee Doubles',
      helpMove:
        'Du steuerst die Figur mit dem hellen Ring. Bewege dich mit WASD, Pfeiltasten oder dem linken Joystick auf dem Touchscreen. Die Richtung folgt der Kamera.',
      helpActions:
        'Schlag / Leertaste schlägt auf oder zurück. Smash / E ist ein Kraftschlag, Hechten / Umschalt erhöht die Reichweite, Springen / J bringt Höhe. Auf Touchscreens kannst du gleichzeitig laufen und schlagen.',
      helpRules:
        'Das erste Team mit 7 Punkten gewinnt. Spiele den Ball vor dem zweiten Aufprall zurück. Pro Team ist ein Schlag erlaubt, bevor der Gegner zurückspielt. Boden und dann Glas ist erlaubt; Wand vor Boden oder ein Ball, der das Netz nicht überquert, kostet den Punkt.',
      helpBungee:
        'Dein Partner ist ein NPC. Bleibt zusammen: Das Seil zieht euch bei Spannung zurück. Springe ab 55% Spannung für einen Katapultschub. Ein Zusammenstoß kann beide kurz betäuben.',
      helpCamera:
        'Ziehe das Spielfeld oder nutze Q/R zum Drehen. Kamera / C wechselt die Ansicht. Auch beim Drehen des Handys bleibt der Platz sichtbar.',
      helpSwitch:
        'Team wechseln gleicht die NPCs aus und startet den aktuellen Punkt ohne Wertung neu. Zurücksetzen startet ein neues Spiel. Diese Hilfe pausiert das lokale Spiel.',
      close: 'Zurück zum Spiel',
      orbitHint: 'Spielfeld ziehen für 360°-Drehung',
      red: 'Rot',
      blue: 'Blau',
      team: 'Team',
      serving: 'Aufschlag',
      rally: 'BALLWECHSEL',
      hotStreak: 'HEISSE SERIE!',
      bungeeStrain: 'BUNGEE-SPANNUNG',
      criticalSnap: 'AKUTE REISSGEFAHR!',
      slingshotReady: 'KATAPULT BEREIT',
      rallyUpdate: 'BALLWECHSEL',
      wins: 'GEWINNT!',
      matchComplete: 'Meisterschaftsspiel beendet',
      playAgain: 'Nochmal spielen',
      volley: 'Volley',
      smash: 'Schmettern',
      dive: 'Hechten',
      switchTeam: 'Team wechseln',
      camera: 'Kamera',
      reset: 'Zurücksetzen',
      touchCam: 'KAM',
      touchSmash: 'SMASH',
      touchDive: 'HECHTEN',
      touchHit: 'SCHLAG',
    },
  };
