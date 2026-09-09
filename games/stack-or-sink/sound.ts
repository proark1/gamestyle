import { audioProfile as stackAudioProfile } from './audio/profile';
import { SiteAudio } from '../../shared/audio/player';
import { Footsteps, type AudioEvent } from '../../shared/audio/world';
import { playEvents } from '../../shared/audio/events';
import { stackEvents, stackSurface } from './audio/events';
import type { Snapshot, Player } from './types';
import { StackAmbience, stackLoopLevels } from './audio/ambience';
export class Sound extends SiteAudio {
  private stack?: Snapshot;
  private stackAmbience = new StackAmbience();
  private craneUntil = 0;
  private stackYaw = 0.65;
  private footsteps = new Footsteps();
  private activeCode = '';
  private events(cues: AudioEvent[]) {
    playEvents(this, cues);
  }
  menu() {
    this.reset();
    this.activeCode = '';
    this.atmosphere('menu');
  }

  constructor() {
    super('stack-or-sink', stackAudioProfile);
    this.atmosphere('menu');
  }
  reset() {
    super.reset();
    this.stack = undefined;
    this.footsteps.reset();
    this.craneUntil = 0;
    this.stackAmbience.reset();
  }
  stackSnapshot(next: Snapshot, id: string) {
    if (
      this.stack?.code === next.code &&
      this.stack.world.started === next.world.started &&
      next.world.clock < this.stack.world.clock
    )
      return;
    if (
      this.activeCode !== next.code ||
      (this.stack &&
        (this.stack.world.started !== next.world.started ||
          next.world.clock - this.stack.world.clock > 2500))
    )
      this.reset();
    this.activeCode = next.code;
    const w = next.world,
      old = this.stack?.world,
      me = w.players.find((p) => p.id === id);
    if (me) this.listen(me, this.stackYaw);
    const levels = stackLoopLevels(w, me ?? { x: 0, y: 0, z: 0 });
    const state =
      w.phase === 'lobby'
        ? 'menu'
        : w.phase === 'won'
          ? 'win'
          : w.phase === 'lost'
            ? 'fail'
            : levels.challenge
              ? 'challenge'
              : 'build';
    const music =
      state === 'build' || state === 'challenge'
        ? this.preferredCue(`music.cinematic.${state}`, `music.${state}`)
        : `music.${state}`;
    this.setLoop('music', music, w.phase === 'playing' ? levels.music : 1);
    this.setLoop(
      'site',
      w.phase === 'lobby' ? null : 'ambience.site',
      levels.surf,
    );
    this.setLoop(
      'trees',
      w.phase === 'lobby' ? null : 'ambience.trees',
      levels.wind,
    );
    if (old) this.events(stackEvents(old, w));
    else if (
      w.phase === 'playing' &&
      w.clock - w.started < 2000 &&
      w.mode !== 'practice'
    )
      this.play('speech.start');
    if (
      old &&
      w.crane.piece &&
      Math.hypot(
        w.crane.x - old.crane.x,
        w.crane.y - old.crane.y,
        w.crane.z - old.crane.z,
      ) > 0.02
    )
      this.craneUntil = w.clock + 400;
    const crane =
      !!w.crane.piece && w.clock < this.craneUntil && w.phase === 'playing';
    this.setLoop(
      'crane',
      crane ? 'ambience.crane' : null,
      me
        ? Math.max(
            0,
            1 -
              Math.hypot(me.x - w.crane.x, me.y - w.crane.y, me.z - w.crane.z) /
                24,
          )
        : 0.5,
    );
    if (old && this.craneUntil > old.clock && !crane)
      this.play('event.crane-stop', 0.6, w.crane);
    this.setLoop(
      'flood',
      w.phase === 'playing' && w.water > 0 ? 'ambience.flood' : null,
      levels.flood,
    );
    this.events(this.stackAmbience.update(w, old, me ?? { x: 0, y: 0, z: 0 }));
    if (w.phase === 'playing')
      for (const p of [...w.players].sort((a, b) =>
        me
          ? Math.hypot(a.x - me.x, a.y - me.y, a.z - me.z) -
            Math.hypot(b.x - me.x, b.y - me.y, b.z - me.z)
          : 0,
      ))
        if (p.id !== id && !p.down && !p.rescued)
          this.events(
            this.footsteps.update(
              p.id,
              p,
              p.grounded || w.water > p.y + 0.1,
              stackSurface(p, w),
              w.clock,
              true,
            ),
          );
    this.stack = structuredClone(next);
  }
  localMovement(player: Player, yaw: number, active: boolean) {
    if (
      !this.stack ||
      !active ||
      player.down ||
      player.rescued ||
      this.stack.world.phase !== 'playing'
    )
      return;
    this.listen(player, yaw);
    this.stackYaw = yaw;
    this.events(
      this.footsteps.update(
        player.id,
        player,
        player.grounded || this.stack.world.water > player.y + 0.1,
        stackSurface(player, this.stack.world),
        performance.now(),
        true,
      ),
    );
  }
}
