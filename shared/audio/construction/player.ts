import { DEFAULT_SETTINGS, type AudioManifest, type GameId } from './types';
export type Atmosphere =
  | 'menu'
  | 'lobby'
  | 'build'
  | 'challenge'
  | 'lastCall'
  | 'inspection'
  | 'results'
  | 'win'
  | 'fail';

/** Runtime loads only the published manifest, never prompts or provider credentials. */
export class SiteAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private manifest: AudioManifest = { settings: DEFAULT_SETTINGS, cues: {} };
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private sources = new Set<AudioBufferSourceNode>();
  private loops = new Map<
    string,
    { id: string; source?: AudioBufferSourceNode; gain?: GainNode }
  >();
  private recent = new Map<string, number>();
  private timer: ReturnType<typeof setInterval>;
  private disposed = false;
  private muted = false;
  private outputLevel = 0.8;
  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    this.outputLevel = Math.max(0, Math.min(1, value));
    this.enabled = !this.muted;
  }
  private voiceDucked = false;
  private speechActive = false;
  private speechSource: AudioBufferSourceNode | null = null;
  private lastTake = new Map<string, string>();
  private mood: { state: Atmosphere; variation: number } | null = null;
  private retiring = new Set<AudioBufferSourceNode>();
  private captureDestination: MediaStreamAudioDestinationNode | null = null;
  captureStream() {
    this.unlock();
    if (!this.context || !this.master) return undefined;
    if (!this.captureDestination) {
      this.captureDestination = this.context.createMediaStreamDestination();
      this.master.connect(this.captureDestination);
    }
    return this.captureDestination.stream;
  }
  duck(active: boolean) {
    this.voiceDucked = active;
    if (active && this.speechSource) this.speechSource.stop();
    this.updateLoopVolumes();
  }
  private updateLoopVolumes() {
    if (!this.context) return;
    for (const entry of this.loops.values())
      entry.gain?.gain.setTargetAtTime(
        this.volume(entry.id),
        this.context.currentTime,
        0.15,
      );
  }
  private lastPosition: { x: number; y: number; z: number } | null = null;
  private stride = 0;
  private airborne = false;
  constructor(readonly game: GameId) {
    void this.refresh();
    this.timer = setInterval(() => {
      void this.refresh();
    }, 30_000);
    document.addEventListener('pointerdown', this.gesture);
    document.addEventListener('keydown', this.gesture);
  }
  private gesture = (event: Event) => {
    this.unlock();
    if ((event.target as HTMLElement)?.closest?.('button'))
      this.play('event.ui');
  };
  get enabled() {
    return !this.muted;
  }
  set enabled(value: boolean) {
    this.muted = !value;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        value ? this.outputLevel : 0,
        this.context.currentTime,
        0.04,
      );
  }
  unlock() {
    if (this.disposed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : this.outputLevel;
        const compressor = this.context.createDynamicsCompressor();
        this.master.connect(compressor);
        compressor.connect(this.context.destination);
      }
      void this.context.resume().then(() => {
        for (const [channel, entry] of this.loops)
          if (!entry.source) void this.startLoop(channel, entry);
      });
    } catch {
      /* Browser audio is optional. */
    }
  }
  async refresh() {
    try {
      const response = await fetch(
        `/api/handwerker/audio/${this.game}?manifest=1`,
        {
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!response.ok || this.disposed) return;
      const next = (await response.json()) as AudioManifest;
      if (this.disposed) return;
      const previous = this.manifest;
      this.manifest = next;
      // setLoop removes and reinserts entries. Iterating the live Map would never finish.
      const activeLoops = [...this.loops];
      for (const [channel, entry] of activeLoops) {
        if (previous.cues[entry.id]?.url !== next.cues[entry.id]?.url) {
          const id = entry.id;
          this.setLoop(channel, null);
          this.setLoop(channel, id);
        } else if (entry.gain && this.context)
          entry.gain.gain.setTargetAtTime(
            this.volume(entry.id),
            this.context.currentTime,
            0.1,
          );
      }
      if (this.mood) this.atmosphere(this.mood.state, this.mood.variation);
    } catch {
      /* Missing libraries are silent; no generation happens during play. */
    }
  }
  private volume(id: string) {
    const cue = this.manifest.cues[id];
    if (!cue) return 0;
    const channel =
      cue.category === 'material' || cue.category === 'event'
        ? 'effects'
        : cue.category;
    const conversationGain = this.voiceDucked
      ? channel === 'music' || channel === 'ambience'
        ? 0.25
        : channel === 'speech'
          ? 0
          : 0.65
      : this.speechActive && (channel === 'music' || channel === 'ambience')
        ? 0.45
        : 1;
    return cue.volume * this.manifest.settings[channel] * conversationGain;
  }
  private takes(id: string) {
    return Object.keys(this.manifest.cues).filter(
      (key) => key === id || this.manifest.cues[key].variantOf === id,
    );
  }
  private take(id: string) {
    const options = this.takes(id),
      previous = this.lastTake.get(id);
    const available =
      options.length > 1 ? options.filter((key) => key !== previous) : options;
    const selected =
      available[Math.floor(Math.random() * available.length)] || id;
    this.lastTake.set(id, selected);
    return selected;
  }
  private buffer(id: string) {
    const cue = this.manifest.cues[id],
      ctx = this.context;
    if (!cue || !ctx) return Promise.resolve(null);
    let pending = this.buffers.get(cue.url);
    if (!pending) {
      pending = (async () => {
        try {
          const res = await fetch(cue.url, {
            signal: AbortSignal.timeout(12000),
          });
          if (!res.ok || this.disposed) return null;
          return await ctx.decodeAudioData(await res.arrayBuffer());
        } catch {
          return null;
        }
      })();
      this.buffers.set(cue.url, pending);
      if (this.buffers.size > 24)
        this.buffers.delete(this.buffers.keys().next().value!);
      void pending.then((value) => {
        if (!value) this.buffers.delete(cue.url);
      });
    }
    return pending;
  }
  play(id: string, strength = 1) {
    if (
      this.muted ||
      document.hidden ||
      !this.context ||
      this.disposed ||
      !this.takes(id).length
    )
      return;
    const now = performance.now(),
      speech = id.startsWith('speech.'),
      cooldown = speech ? 'speech' : id;
    if (speech && (this.voiceDucked || this.speechActive)) return;
    if (now - (this.recent.get(cooldown) ?? -10_000) < (speech ? 2000 : 100))
      return;
    this.recent.set(cooldown, now);
    id = this.take(id);
    if (speech) {
      this.speechActive = true;
      this.updateLoopVolumes();
    }
    void this.buffer(id).then((buffer) => {
      if (
        !buffer ||
        this.disposed ||
        !this.context ||
        !this.master ||
        this.muted ||
        performance.now() - now > 2500 ||
        this.sources.size >= (id.startsWith('timer.') || speech ? 12 : 10) ||
        (speech && this.voiceDucked) ||
        document.hidden
      ) {
        if (speech) {
          this.speechActive = false;
          this.updateLoopVolumes();
        }
        return;
      }
      const source = this.context.createBufferSource(),
        gain = this.context.createGain();
      source.buffer = buffer;
      gain.gain.value = this.volume(id) * Math.max(0, Math.min(1, strength));
      source.connect(gain);
      gain.connect(this.master);
      this.sources.add(source);
      if (speech) this.speechSource = source;
      source.onended = () => {
        this.sources.delete(source);
        source.disconnect();
        gain.disconnect();
        if (speech) {
          this.speechActive = false;
          this.speechSource = null;
          this.updateLoopVolumes();
        }
      };
      source.start();
    });
  }
  setLoop(channel: string, id: string | null) {
    const previous = this.loops.get(channel);
    if (previous?.id === id) return;
    if (previous?.source) {
      const source = previous.source;
      if (
        channel === 'music' &&
        this.context &&
        previous.gain &&
        !this.disposed
      ) {
        previous.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.14);
        this.retiring.add(source);
        source.onended = () => {
          source.disconnect();
          previous.gain?.disconnect();
          this.retiring.delete(source);
        };
        source.stop(this.context.currentTime + 0.65);
      } else {
        source.stop();
        source.disconnect();
        previous.gain?.disconnect();
      }
    }
    this.loops.delete(channel);
    if (!id || this.disposed) return;
    const entry = { id };
    this.loops.set(channel, entry);
    void this.startLoop(channel, entry);
  }
  private async startLoop(
    channel: string,
    entry: { id: string; source?: AudioBufferSourceNode; gain?: GainNode },
  ) {
    if (entry.source || !this.context || this.context.state !== 'running')
      return;
    const buffer = await this.buffer(entry.id);
    if (
      !buffer ||
      this.disposed ||
      this.loops.get(channel) !== entry ||
      !this.context ||
      !this.master ||
      entry.source
    )
      return;
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = this.manifest.cues[entry.id]?.loop ?? false;
    gain.gain.value = channel === 'music' ? 0 : this.volume(entry.id);
    if (channel === 'music')
      gain.gain.setTargetAtTime(
        this.volume(entry.id),
        this.context.currentTime,
        0.14,
      );
    source.connect(gain);
    gain.connect(this.master);
    entry.source = source;
    entry.gain = gain;
    source.start();
  }
  atmosphere(state: Atmosphere, variation = 0) {
    this.mood = { state, variation };
    const fallback: Partial<Record<Atmosphere, Atmosphere>> = {
      lobby: 'menu',
      lastCall: 'challenge',
      inspection: 'build',
      results: 'build',
    };
    const id = `music.${state}`,
      options = this.takes(id);
    const selected = options.length
      ? options[
          ((variation % options.length) + options.length) % options.length
        ]
      : this.takes(`music.${fallback[state]}`)[0] || id;
    this.setLoop('music', selected);
    this.setLoop('site', state === 'menu' ? null : 'ambience.site');
    this.setLoop('trees', state === 'menu' ? null : 'ambience.trees');
    if (this.game === 'chaos')
      this.setLoop('crane', state === 'menu' ? null : 'ambience.crane');
  }
  movement(
    position: { x: number; y: number; z: number },
    surface: 'dirt' | 'wood' | 'concrete' | 'brick' | 'roof',
    grounded: boolean,
  ) {
    if (this.lastPosition) {
      const distance = Math.hypot(
        position.x - this.lastPosition.x,
        position.z - this.lastPosition.z,
      );
      if (distance < 2 && grounded) {
        this.stride += distance;
        if (this.stride > 0.95) {
          this.play(`step.${surface}`);
          this.stride = 0;
        }
      }
      if (
        !grounded &&
        !this.airborne &&
        position.y > this.lastPosition.y + 0.04
      )
        this.play('event.jump');
      if (grounded && this.airborne) this.play('event.land');
    }
    this.lastPosition = position;
    this.airborne = !grounded;
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    document.removeEventListener('pointerdown', this.gesture);
    document.removeEventListener('keydown', this.gesture);
    for (const channel of this.loops.keys()) this.setLoop(channel, null);
    for (const source of this.sources) source.stop();
    for (const source of this.retiring) source.stop();
    this.retiring.clear();
    this.sources.clear();
    this.buffers.clear();
    void this.context?.close();
  }
}
