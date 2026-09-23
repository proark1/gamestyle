import type { PartyPlayer, PartyRoomState } from '@/platform/party/types';
import { getPartyGameInfo } from '@/platform/party/playlist';

export type PartyAward = { playerId: string; label: string };

export function partyAwards(room: PartyRoomState, de: boolean): PartyAward[] {
  const humans = room.players.filter((player) => !player.isBot);
  if (!humans.length || !room.roundResults.length) return [];
  const earned = (player: PartyPlayer) =>
    room.roundResults.reduce(
      (sum, round) => sum + (round.pointsAwarded[player.id] ?? 0),
      0,
    );
  const appeared = (player: PartyPlayer) =>
    room.roundResults.filter((round) => round.reports?.[player.id] != null)
      .length;
  const last = room.roundResults.at(-1);
  const awards: PartyAward[] = [];
  const pick = (score: (player: PartyPlayer) => number, label: string) => {
    const ranked = [...humans].sort(
      (a, b) => score(b) - score(a) || a.name.localeCompare(b.name),
    );
    if (ranked[0] && score(ranked[0]) > 0)
      awards.push({ playerId: ranked[0].id, label });
  };
  pick(earned, de ? 'Punkte-Magnet' : 'Point magnet');
  pick(appeared, de ? 'Immer dabei' : 'Always in');
  if (room.roundResults.length > 1 && last)
    pick(
      (player) => last.pointsAwarded[player.id] ?? 0,
      de ? 'Finale-Funken' : 'Finale spark',
    );
  return awards;
}

export async function partyCard(
  room: PartyRoomState,
  de: boolean,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  const colors = ['#eeb958', '#54bda4', '#ef877e', '#a89ad6'];
  const players = room.players
    .filter((player) => !player.isBot)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const awards = partyAwards(room, de);
  const rounded = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  };
  const name = (value: string, max: number) =>
    value.length > max ? `${value.slice(0, max - 1)}…` : value;

  ctx.fillStyle = '#173a31';
  ctx.fillRect(0, 0, 1200, 1200);
  ctx.fillStyle = '#f8d581';
  ctx.beginPath();
  ctx.arc(1080, 100, 270, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a3d9c8';
  ctx.beginPath();
  ctx.arc(50, 1100, 300, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f4f7e8';
  rounded(64, 64, 1072, 1072, 44);
  ctx.fillStyle = '#276d5d';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('JUMBLEYARD', 112, 142);
  ctx.fillStyle = '#173a31';
  ctx.font = 'bold 76px sans-serif';
  ctx.fillText(de ? 'Unsere Party' : 'Our party', 108, 238);
  ctx.font = '28px sans-serif';
  ctx.fillStyle = '#53736a';
  ctx.fillText(
    `${room.roundResults.length} ${de ? 'Runden' : 'rounds'}  ·  ${players.length} ${de ? 'Spieler' : 'players'}`,
    112,
    288,
  );

  players.forEach((player, index) => {
    const y = 335 + index * 145;
    ctx.fillStyle = '#e5eddf';
    rounded(106, y, 988, 122, 25);
    ctx.fillStyle = colors[player.color] ?? colors[0];
    rounded(124, y + 15, 90, 90, 24);
    ctx.fillStyle = '#173a31';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(name(player.name, 21), 239, y + 57);
    ctx.font = '25px sans-serif';
    ctx.fillStyle = '#53736a';
    const labels = awards
      .filter((award) => award.playerId === player.id)
      .map((award) => award.label);
    ctx.fillText(labels.join(' · ').slice(0, 44), 240, y + 94);
    ctx.font = 'bold 43px sans-serif';
    ctx.fillStyle = '#173a31';
    ctx.textAlign = 'right';
    ctx.fillText(`${player.score}`, 1065, y + 77);
    ctx.textAlign = 'left';
  });

  const games = room.roundResults
    .map((result) => getPartyGameInfo(result.game)?.name)
    .filter(Boolean)
    .slice(0, 5)
    .join('  ·  ');
  ctx.fillStyle = '#276d5d';
  ctx.font = 'bold 27px sans-serif';
  ctx.fillText(de ? 'Gespielt' : 'Played', 112, 1018);
  ctx.font = '24px sans-serif';
  ctx.fillStyle = '#53736a';
  ctx.fillText(name(games, 63), 112, 1065);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('Image export failed')),
      'image/png',
    ),
  );
}

export async function sharePartyCard(room: PartyRoomState, de: boolean) {
  const blob = await partyCard(room, de);
  const file = new File([blob], 'jumbleyard-party.png', { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Jumbleyard Party' });
      return;
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
