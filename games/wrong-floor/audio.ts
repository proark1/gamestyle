import { hotelDetails } from './audio-details';
import { SiteAudio } from '../../shared/audio/player';
import type { Cue } from '../../shared/audio/types';
import type { HotelSnapshot } from './types';
import { HotelFoley, type HotelCue } from './foley';
import { HotelFootsteps, hotelHorror, type HotelPoint } from './horror';

const effects: Record<HotelCue, [string, string]> = {
  start: ['Elevator arrival', 'An old brass elevator bell dings twice.'],
  report: [
    'Finding shared',
    'A quiet walkie talkie switch clicks with a short burst of static.',
  ],
  vote: [
    'Elevator button',
    'One solid brass elevator button depresses with a mechanical click.',
  ],
  correct: [
    'Correct floor',
    'Two descending notes from a real mechanical elevator bell.',
  ],
  alarm: ['Wrong floor', 'A worn mechanical hotel alarm buzzes low and rough.'],
  safe: [
    'Elevator held',
    'A hand stops a sliding elevator door with a metallic clunk.',
  ],
  finish: [
    'Checkout',
    'A hotel reception desk bell rings with a natural metal decay.',
  ],
  knock: [
    'Private knocking',
    'Three distinct hollow knocks on a thick wooden hotel room door.',
  ],
  'door-knock': [
    'Door knock impact',
    'One firm hollow knuckle knock on a thick wooden hotel room door.',
  ],
  step: [
    'Carpet footsteps',
    'One shoe heel and sole compress thick carpet, with soft fabric friction.',
  ],
  'step-metal': [
    'Elevator footsteps',
    'One shoe strikes a resonant metal elevator floor, heel then sole.',
  ],
  'step-wood': [
    'Wood footsteps',
    'One shoe strikes old wooden floorboards with a short hollow thud.',
  ],
  'wet-step': [
    'Unseen wet footsteps',
    'One bare wet foot presses onto carpet with a sticky squelch and light water splash.',
  ],
  handle: [
    'Turning handle',
    'A brass door handle turns against a stiff spring and rattles back into place.',
  ],
  clock: [
    'Backwards clock',
    'One close mechanical clock escapement ticks and slips backwards.',
  ],
  light: [
    'Failing light',
    'A failing lamp ballast spits and crackles, with a brief electrical hum.',
  ],
  creak: [
    'Portrait frame',
    'An old wooden picture frame twists slowly with a dry strained creak.',
  ],
  breath: [
    'Someone nearby',
    'One slow raspy human breath through an open mouth, close and uneasy, no words.',
  ],
  'ghost-step': [
    'Pursuer footsteps',
    'One heavy dragging foot lands on carpet with a deep thud and long fabric scrape.',
  ],
  slam: [
    'Door impact',
    'A heavy wooden hotel door slams with a bass impact and loose latch rattle.',
  ],
  doors: [
    'Sliding elevator doors',
    'Heavy metal elevator doors slide on gritty rollers and stop with a clunk.',
  ],
  motor: [
    'Elevator machinery',
    'An old elevator motor starts with a low rumble and strains up to speed.',
  ],
  inspect: [
    'Clue notebook',
    'A small paper notebook opens and a fingertip brushes the page.',
  ],
  heartbeat: [
    'Racing pulse',
    'A close low human heartbeat, two soft chest thumps, no music.',
  ],
  caught: [
    'Caught by the hotel',
    'A heavy coat rushes close, rough fabric grabs, and a low body impact.',
  ],
  pipe: [
    'Settling pipes',
    'A distant heating pipe taps once and resonates faintly inside a wall.',
  ],
};
export const hotelFallbackCatalog: Cue[] = Object.entries(effects).map(
  ([id, [name, prompt]]) => ({
    id: `event.${id}`,
    name,
    prompt: `${prompt} Isolated realistic Foley, no speech or music.`,
    group: 'The hotel',
    category: 'event',
    text: '',
    duration: id === 'motor' ? 3 : 2,
    loop: false,
    volume: id === 'alarm' ? 0.5 : 0.65,
  }),
);

export const hotelCatalog: Cue[] = [...hotelFallbackCatalog, ...hotelDetails];

export class HotelSound {
  private clips: SiteAudio;
  private available = new Set<string>();
  private foley = new HotelFoley();
  private footsteps = new HotelFootsteps();
  private lastEvent = 0;
  private stop = '';
  private previous: HotelSnapshot | null = null;
  private played = new Map<string, string>();
  private abort = new AbortController();
  private suspended = false;
  constructor() {
    this.clips = new SiteAudio('wrong-floor', {
      preload: () => true,
      effectLimit: 24,
      availableVariants: true,
      crossfadeMusic: true,
      bufferLimit: 56,
      warmLimit: 48,
      natural: () => true,
      range: () => 23,
      attenuation: (_id, distance) =>
        distance >= 23 ? 0 : 1 / (1 + distance * distance * 0.065),
      cooldownKey: (id, source) => `${id}:${source ?? ''}`,
      prepareManifest: (manifest) => {
        this.available = new Set(Object.keys(manifest.cues));
        return manifest;
      },
    });
    this.clips.setLoop('music', 'music.menu', 0.65);
    document.addEventListener(
      'visibilitychange',
      () => {
        this.suspended = document.hidden;
        this.footsteps.reset();
        if (document.hidden) this.clips.reset();
      },
      { signal: this.abort.signal },
    );
    for (const gesture of ['pointerdown', 'keydown'])
      document.addEventListener(gesture, () => this.foley.unlock(), {
        signal: this.abort.signal,
      });
  }
  set enabled(value: boolean) {
    this.clips.enabled = value;
    if (!value) this.clips.reset();
    this.foley.setEnabled(value);
  }
  duck(active: boolean) {
    this.clips.duck(active);
    this.foley.duck(active);
  }
  unlock() {
    this.clips.unlock();
    this.foley.unlock();
  }
  listen(position: HotelPoint, yaw: number) {
    this.foley.listen(position, yaw);
    this.clips.listen(position, yaw);
  }
  private cue(
    kind: HotelCue,
    position?: HotelPoint,
    strength = 1,
    source?: string,
  ) {
    if (
      ['step', 'step-metal', 'step-wood'].includes(kind) &&
      [0, 1, 2, 3].some((n) =>
        this.available.has(`event.${kind}${n ? `.${n}` : ''}`),
      )
    )
      this.clips.variant(`event.${kind}`, strength, position, source);
    else if (this.available.has(`event.${kind}`))
      this.clips.play(`event.${kind}`, strength, position, source);
    else this.foley.play(kind, position, strength);
  }
  private once(
    channel: string,
    key: string,
    kind: HotelCue,
    position?: HotelPoint,
    strength = 1,
  ) {
    if (!key || this.played.get(channel) === key) return;
    this.played.set(channel, key);
    this.cue(kind, position, strength, channel);
  }
  update(snapshot: HotelSnapshot, id: string) {
    const { world: w, you } = snapshot;
    if (
      this.previous &&
      w.run === this.previous.world.run &&
      w.clock < this.previous.world.clock
    )
      return;
    if (
      w.eventId < this.lastEvent ||
      (this.previous && w.clock - this.previous.world.clock > 2500)
    ) {
      this.lastEvent = w.eventId;
      this.footsteps.reset();
      this.played.clear();
    }
    const me = w.players.find((p) => p.id === id);
    const h = hotelHorror(snapshot);
    const stop = `${w.run}:${w.stopAt}`;
    if (stop !== this.stop) {
      this.stop = stop;
      this.played.clear();
      this.footsteps.reset();
      this.foley.stopEffects();
    }
    if (!this.previous && w.clock - w.stopAt > 1200) this.lastEvent = w.eventId;
    if (this.suspended || document.hidden) {
      this.lastEvent = w.eventId;
      this.previous = snapshot;
      return;
    }
    if (me) this.listen(me, this.foley.yaw);
    const music =
      w.phase === 'lobby'
        ? 'menu'
        : w.phase === 'escape'
          ? 'escape'
          : w.phase === 'won'
            ? 'win'
            : w.phase === 'lost'
              ? 'fail'
              : 'tension';
    this.clips.setLoop(
      'music',
      `music.${music}`,
      w.phase === 'playing' ? 0.35 : 0.65,
    );
    const bed =
      w.phase === 'playing' && w.stage === 'travel'
        ? 'ambience.elevator'
        : h.active
          ? 'ambience.hotel'
          : null;
    this.clips.setLoop('hotel', bed, 0.6 * (1 - h.lightDip * 0.65));
    if (this.previous?.world.phase === 'lobby' && w.phase === 'lobby') {
      const before = new Set(
        this.previous.world.players.filter((p) => !p.bot).map((p) => p.id),
      );
      const now = new Set(w.players.filter((p) => !p.bot).map((p) => p.id));
      if ([...now].some((id) => !before.has(id)))
        this.clips.play('event.join', 0.6);
      if ([...before].some((id) => !now.has(id)))
        this.clips.play('event.leave', 0.6);
    }
    if (
      this.previous &&
      w.phase === 'lost' &&
      this.previous.world.phase !== 'lost'
    )
      this.clips.play('event.fail');
    this.foley.ambience(
      !(bed && this.available.has(bed)) &&
        (h.active || (w.phase === 'playing' && w.stage === 'travel')),
      1 - h.lightDip * 0.65,
    );
    for (const e of w.events)
      if (e.id > this.lastEvent) {
        this.lastEvent = e.id;
        const position =
          e.kind === 'vote'
            ? { x: 0, z: -23.5 }
            : e.kind === 'safe' || e.kind === 'start' || e.kind === 'correct'
              ? { x: 0, z: 1 }
              : undefined;
        this.cue(e.kind, position);
        if (e.kind === 'start') this.cue('doors', { x: 0, z: 1 });
        if (e.kind === 'alarm') this.cue('slam', { x: 4.5, z: -16 });
      }
    if (
      w.phase === 'playing' &&
      w.stage === 'travel' &&
      this.previous?.world.stage !== 'travel'
    ) {
      this.cue('doors');
      this.cue('motor');
    }
    if (you.inspected && !this.previous?.you.inspected)
      this.cue('inspect', undefined, 0.65);
    if (
      me?.caught &&
      !this.previous?.world.players.find((p) => p.id === id)?.caught
    )
      this.cue('caught');
    for (const step of this.footsteps.update(snapshot)) {
      const kind =
        step.surface === 'carpet'
          ? 'step'
          : step.surface === 'metal'
            ? 'step-metal'
            : 'step-wood';
      this.cue(
        kind,
        step.id === id ? undefined : step.position,
        step.running ? 1 : 0.72,
        step.id,
      );
    }
    if (h.active) {
      this.once(
        'pipe',
        String(Math.floor(h.elapsed / 19500)),
        'pipe',
        { x: -4.6, z: -2 },
        0.28,
      );
      this.once('knock', h.knockKey, 'door-knock', { x: 4.5, z: -16 });
      this.once('handle', h.handleKey, 'handle', { x: 4.5, z: -16 });
      this.once(
        'wet',
        h.wetKey,
        'wet-step',
        {
          x: -2.3 + (h.wetStep % 2 ? 0.17 : -0.17),
          z: -2.5 - h.wetStep * 0.52,
        },
        0.9,
      );
      if (
        w.phase === 'playing' &&
        w.stage === 'inspect' &&
        you.anomaly &&
        you.station === 3
      )
        this.once(
          'clock',
          String(h.clockStep),
          'clock',
          { x: 0, z: -24.7 },
          0.75,
        );
      if (h.encounter) {
        this.once('light', String(h.cycle), 'light', {
          x: 0,
          z: [-3, -12, -21][h.lamp],
        });
        if (h.portrait)
          this.once('creak', String(h.cycle), 'creak', { x: -4.5, z: -11 });
        if (you.apparition)
          this.once('breath', String(h.cycle), 'breath', h.ghostPosition);
      }
      if (w.phase === 'escape' && me && !me.safe && !me.caught) {
        const danger = Math.max(0, 1 - Math.abs(me.z - w.ghostZ) / 18);
        this.once(
          'heartbeat',
          String(Math.floor((w.clock - w.escapeAt) / 720)),
          'heartbeat',
          undefined,
          0.3 + danger * 0.65,
        );
        this.once(
          'pant',
          String(Math.floor((w.clock - w.escapeAt) / 1900)),
          'breath',
          undefined,
          0.55,
        );
        if (you.apparition && w.clock - w.escapeAt > 1800)
          this.once(
            'pursuer',
            String(Math.floor((w.clock - w.escapeAt - 1800) / 470)),
            'ghost-step',
            h.ghostPosition,
          );
      }
    }
    this.previous = snapshot;
  }
  reset() {
    this.lastEvent = 0;
    this.stop = '';
    this.previous = null;
    this.played.clear();
    this.footsteps.reset();
    this.foley.reset();
    this.clips.reset();
    this.clips.duck(false);
    this.clips.setLoop('music', 'music.menu', 0.65);
  }
  dispose() {
    this.abort.abort();
    this.clips.dispose();
    this.foley.dispose();
  }
}
