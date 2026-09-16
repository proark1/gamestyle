import type { Localized } from '../../shared/language/types';

export interface PanicCurlingTranslation {
  redRovers: string;
  blueBlazers: string;
  deliverer: string;
  sweeper: string;
  defender: string;
  selectTeam: string;
  selectRole: string;
  thinIceWarning: string;
  waitingOpponent: string;
  graniteName: string;
  graniteSub: string;
  anvilName: string;
  anvilSub: string;
  teammateName: string;
  teammateSub: string;
  curlLeft: string;
  curlRight: string;
  launchPower: string;
  guardShot: string;
  drawToHouse: string;
  highTakeout: string;
  zoneGuard: string;
  zoneDraw: string;
  zoneTakeout: string;
  aimLeft: string;
  aimRight: string;
  center: string;
  reset: string;
  deliverStone: string;
  releaseAtPeak: string;
  steerLeft: string;
  steerRight: string;
  sweepHarder: string;
  tossBanana: string;
  endComplete: string;
  endDesc: string;
  freshIce: string;
  matchFinished: string;
  redWins: string;
  blueWins: string;
  draw: string;
  playAgain: string;
}

export const PANIC_CURLING_TRANSLATIONS: Localized<PanicCurlingTranslation> = {
  en: {
    redRovers: 'Red Rovers',
    blueBlazers: 'Blue Blazers',
    deliverer: 'Deliverer',
    sweeper: 'Sweeper',
    defender: 'Defender',
    selectTeam: 'Select Team',
    selectRole: 'Select Role',
    thinIceWarning: '⚠️ DANGER: THIN ICE IS CRACKING! SPREAD OUT!',
    waitingOpponent: '⏳ Opponent is lining up their throw...',
    graniteName: 'Granite',
    graniteSub: 'Balanced Curler',
    anvilName: 'Anvil',
    anvilSub: 'Cracks Ice • Smash',
    teammateName: 'Teammate',
    teammateSub: 'Agile • Wild Spin',
    curlLeft: '⟲ Curl Left',
    curlRight: '⟳ Curl Right',
    launchPower: 'Launch Power',
    guardShot: '🛡️ Guard Shot',
    drawToHouse: '🎯 Draw to House (Tee)',
    highTakeout: '💥 High Takeout!',
    zoneGuard: 'Guard (0-35%)',
    zoneDraw: 'House Draw (35-72%)',
    zoneTakeout: 'Takeout (72-100%)',
    aimLeft: '◀ Aim Left',
    aimRight: 'Aim Right ▶',
    center: 'Center',
    reset: 'Reset',
    deliverStone: 'DELIVER STONE! 🚀',
    releaseAtPeak: 'Release at peak power to shoot',
    steerLeft: '⇦ Steer Left',
    steerRight: 'Steer Right ⇨',
    sweepHarder: 'SWEEP HARDER!',
    tossBanana: '🍌 Toss Banana ({count} left)',
    endComplete: 'END {round} COMPLETE!',
    endDesc: 'The stones have settled in the House. Here are the round scores:',
    freshIce: 'Preparing next end on fresh ice...',
    matchFinished: 'MATCH FINISHED!',
    redWins: '🏆 RED ROVERS WIN THE TOURNAMENT!',
    blueWins: '🏆 BLUE BLAZERS WIN THE TOURNAMENT!',
    draw: '🤝 IT’S A FROZEN DRAW!',
    playAgain: 'PLAY AGAIN',
  },
  de: {
    redRovers: 'Red Rovers',
    blueBlazers: 'Blue Blazers',
    deliverer: 'Werfer',
    sweeper: 'Wischer',
    defender: 'Verteidiger',
    selectTeam: 'Team wählen',
    selectRole: 'Rolle wählen',
    thinIceWarning: '⚠️ GEFAHR: DÜNNES EIS BRICHT! VERTEILEN!',
    waitingOpponent: '⏳ Gegner zielt...',
    graniteName: 'Granit',
    graniteSub: 'Ausgewogener Curler',
    anvilName: 'Amboss',
    anvilSub: 'Bricht Eis • Zerschmettern',
    teammateName: 'Mitspieler',
    teammateSub: 'Wendig • Wilder Spin',
    curlLeft: '⟲ Spin Links',
    curlRight: '⟳ Spin Rechts',
    launchPower: 'Wurfkraft',
    guardShot: '🛡️ Guard-Wurf',
    drawToHouse: '🎯 Ins Haus (Tee)',
    highTakeout: '💥 Wegfegen!',
    zoneGuard: 'Guard (0-35%)',
    zoneDraw: 'Haus-Wurf (35-72%)',
    zoneTakeout: 'Takeout (72-100%)',
    aimLeft: '◀ Ziel Links',
    aimRight: 'Ziel Rechts ▶',
    center: 'Mitte',
    reset: 'Zurücksetzen',
    deliverStone: 'STEIN ABWERFEN! 🚀',
    releaseAtPeak: 'Bei maximaler Kraft loslassen',
    steerLeft: '⇦ Links lenken',
    steerRight: 'Rechts lenken ⇨',
    sweepHarder: 'FESTER WISCHEN!',
    tossBanana: '🍌 Banane werfen ({count} übrig)',
    endComplete: 'END {round} BEENDET!',
    endDesc: 'Die Steine liegen im Haus. Hier ist das Rundenergebnis:',
    freshIce: 'Bereite nächstes End auf frischem Eis vor...',
    matchFinished: 'MATCH BEENDET!',
    redWins: '🏆 RED ROVERS GEWINNEN DAS TURNIER!',
    blueWins: '🏆 BLUE BLAZERS GEWINNEN DAS TURNIER!',
    draw: '🤝 EIN EISIGES UNENTSCHIEDEN!',
    playAgain: 'NOCHMAL SPIELEN',
  },
};
