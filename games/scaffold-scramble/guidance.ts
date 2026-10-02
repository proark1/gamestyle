import { reachableWindow } from './simulation';
import {
  TILT_WARNING_DEG,
  type Player,
  type ScaffoldScrambleWorld,
} from './types';

export function scaffoldHint(world: ScaffoldScrambleWorld, player: Player) {
  if (player.state === 'dangling' || player.state === 'climbing')
    return 'climb';
  if (Math.abs(world.cradle.tiltDeg) >= TILT_WARNING_DEG) return 'balance';
  if (
    world.pigeons.some((p) => p.perched && Math.abs(p.x - player.deckX) < 2.0)
  )
    return 'shoo';
  if (player.role === 'left-winch' || player.role === 'right-winch')
    return 'winch';
  const target = reachableWindow(world, player);
  if (!target) return 'move';
  if (target.status === 'spotless') return 'done';
  if (target.status === 'foamed')
    return player.tool === 'squeegee' ? 'wipe' : 'switchWipe';
  return player.tool === 'sponge' ? 'soap' : 'switchSoap';
}
