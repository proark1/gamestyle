import { audioProfile as farmAudioProfile } from './audio/profile';
import { SiteAudio } from '../../shared/audio/player';
import { Footsteps, type AudioEvent } from '../../shared/audio/world';
import { playEvents } from '../../shared/audio/events';
import { farmEvents } from './audio-events';
import type { FarmSnapshot } from './types';
import { FarmAmbience, farmLoopLevels } from './audio';
import { shockAge, SHOCK_STUN_MS } from './fence';
export class Sound extends SiteAudio {
  private farm?: FarmSnapshot;
  private farmAmbience = new FarmAmbience();
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
    super('act-natural', farmAudioProfile);
    this.atmosphere('menu');
  }
  reset() {
    super.reset();
    this.farm = undefined;
    this.footsteps.reset();
    this.farmAmbience.reset();
  }
  farmSnapshot(next: FarmSnapshot) {
    if (
      this.farm?.code === next.code &&
      this.farm.world.round === next.world.round &&
      this.farm.world.started === next.world.started &&
      next.world.clock < this.farm.world.clock
    )
      return;
    if (
      this.activeCode !== next.code ||
      (this.farm &&
        (this.farm.world.round !== next.world.round ||
          this.farm.world.started !== next.world.started ||
          next.world.clock - this.farm.world.clock > 2500))
    )
      this.reset();
    this.activeCode = next.code;
    const w = next.world,
      old = this.farm?.world;
    const me =
      next.you.role === 'farmer'
        ? w.farmer
        : w.cows.find((c) => c.id === next.you.cowId);
    const listener = me ?? { x: 0, z: 0 };
    this.trackSources(
      new Map([
        ...(w.phase === 'playing' ? [['farmer', w.farmer] as const] : []),
        ...w.cows
          .filter(
            (cow) =>
              (w.phase === 'playing' && !cow.captured && !cow.escaped) ||
              shockAge(cow, w.clock) < SHOCK_STUN_MS,
          )
          .map((cow) => [cow.id, cow] as const),
      ]),
    );
    this.listen(listener, 0.5);
    const ended = w.phase === 'cows-win' || w.phase === 'farmer-win';
    const won =
      next.you.role === 'farmer'
        ? w.phase === 'farmer-win'
        : w.phase === 'cows-win';
    this.atmosphere(
      w.phase === 'lobby'
        ? 'menu'
        : ended
          ? won
            ? 'win'
            : 'fail'
          : w.clock - w.started > 135000
            ? 'challenge'
            : 'build',
    );
    if (old) this.events(farmEvents(old, w));
    else if (w.phase === 'playing' && w.clock - w.started < 2000)
      this.play('speech.start');
    const levels = farmLoopLevels(listener, w.clock);
    this.setLoop(
      'trees',
      w.phase === 'lobby' ? null : 'ambience.trees',
      levels.breeze,
    );
    this.setLoop(
      'fence',
      w.phase === 'playing' && !w.powerOff ? 'ambience.fence' : null,
      levels.fence,
    );
    const working = w.cows.find((c) => c.task > 0 && !c.captured && !c.escaped);
    this.setLoop(
      'panel',
      w.phase === 'playing' && (w.panelAudible ?? !!working)
        ? 'ambience.panel'
        : null,
      levels.panel,
    );
    if (w.phase === 'playing') {
      this.events(
        this.footsteps
          .update('farmer', w.farmer, true, 'grass', w.clock)
          .map((step) => ({ ...step, sourceId: 'farmer' })),
      );
      const steps: AudioEvent[] = [];
      for (const cow of w.cows)
        if (!cow.captured && !cow.escaped)
          steps.push(
            ...this.footsteps
              .update(cow.id, cow, true, 'hoof', w.clock)
              .map((step) => ({ ...step, sourceId: cow.id })),
          );
      const metres = (event: AudioEvent) =>
        event.position
          ? Math.hypot(
              event.position.x - listener.x,
              event.position.z - listener.z,
            )
          : 0;
      // Submit the closest contacts first, before shared voice/cooldown limits apply.
      this.events(
        steps
          .filter((step) => metres(step) < 11)
          .sort((a, b) => metres(a) - metres(b))
          .slice(0, 3)
          .map((step) => ({ ...step, strength: 0.65 })),
      );
      if (old)
        for (const cow of w.cows) {
          const previous = old.cows.find((c) => c.id === cow.id);
          if (
            !previous ||
            cow.captured ||
            cow.escaped ||
            cow.moving ||
            !previous.moving
          )
            continue;
          if (Math.hypot(cow.x - previous.x, cow.z - previous.z) > 1.5)
            continue;
          if (
            Math.hypot(cow.x - listener.x, cow.z - listener.z) < 6 &&
            Math.random() < 0.25
          )
            this.variant('animal.scuff', 0.35, cow, cow.id);
        }
    }
    this.events(this.farmAmbience.update(w, listener));
    this.farm = structuredClone(next);
  }
}
