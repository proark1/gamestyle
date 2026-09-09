import type { AudioProfile } from './profile';
import { DEFAULT_SETTINGS, type AudioManifest, type GameId } from './types';
import { seamlessAmbience } from './loop-buffer';
import {
  audioPreferencesSnapshot,
  registerAudioListener,
  type AudioPreferences,
} from './preferences';

type AudioPoint = { x: number; y?: number; z: number };
type SpatialVoice = {
  id: string;
  position: AudioPoint;
  sourceId?: string;
  strength: number;
  recordingGain: number;
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner?: StereoPannerNode;
  filter?: BiquadFilterNode;
};

/** Runtime loads only the published manifest, never prompts or provider credentials. */
export class SiteAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private manifest: AudioManifest = { settings: DEFAULT_SETTINGS, cues: {} };
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private sources = new Set<AudioBufferSourceNode>();
  private spatialVoices = new Map<AudioBufferSourceNode, SpatialVoice>();
  private sourcePositions = new Map<string, AudioPoint>();
  private recordingGains = new WeakMap<AudioBuffer, Map<string, number>>();
  private loops = new Map<
    string,
    { id: string; source?: AudioBufferSourceNode; gain?: GainNode }
  >();
  private recent = new Map<string, number>();
  private timer: ReturnType<typeof setInterval>;
  private disposed = false;
  private muted = false;
  private level = 1;
  private musicOn = true;
  private unregister: () => void;
  private ducked = false;
  private speechCount = 0;
  private speechEpoch = 0;
  private speechSources = new Set<AudioBufferSourceNode>();
  private epoch = 0;
  private warming = false;
  private variants = new Map<string, number>();
  private loopLevels = new Map<string, number>();
  private pendingMusic?: { id: string; strength: number };
  private listener = { x: 0, y: 0, z: 0, yaw: 0.65 };
  duck(active: boolean) {
    this.ducked = active;
    this.mixLoops();
  }
  /** Site-wide listener preferences; the game's own mute stays separate. */
  applyPreferences(preferences: AudioPreferences) {
    this.level = Math.max(0, Math.min(1, preferences.volume));
    this.musicOn = preferences.music;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        this.masterGain(),
        this.context.currentTime,
        0.05,
      );
    this.mixLoops();
  }
  private masterGain() {
    return this.muted ? 0 : 0.8 * this.level;
  }
  private mixLoops() {
    if (!this.context) return;
    for (const [channel, entry] of this.loops)
      entry.gain?.gain.setTargetAtTime(
        this.loopVolume(channel, entry.id),
        this.context.currentTime,
        0.2,
      );
  }
  private loopVolume(channel: string, id: string) {
    return (
      this.volume(id) *
      (this.loopLevels.get(channel) ?? 1) *
      (this.ducked || this.speechCount ? 0.35 : 1)
    );
  }
  listen(position: { x: number; y?: number; z: number }, yaw = 0.65) {
    this.listener = { ...position, y: position.y ?? 0, yaw };
    for (const voice of this.spatialVoices.values())
      this.mixSpatialVoice(voice, true);
  }
  trackSources(positions: ReadonlyMap<string, AudioPoint>) {
    this.sourcePositions = new Map(positions);
    for (const [source, voice] of this.spatialVoices) {
      if (voice.sourceId && !positions.has(voice.sourceId)) {
        source.stop();
        this.spatialVoices.delete(source);
      } else this.mixSpatialVoice(voice, true);
    }
  }
  private mixSpatialVoice(voice: SpatialVoice, smooth = false) {
    if (!this.context) return;
    const position = voice.sourceId
      ? this.sourcePositions.get(voice.sourceId)
      : voice.position;
    if (!position) return;
    const dx = position.x - this.listener.x,
      dz = position.z - this.listener.z;
    const metres = Math.hypot(
      dx,
      (position.y ?? this.listener.y) - this.listener.y,
      dz,
    );
    const attenuation = this.attenuation(voice.id, metres);
    const set = (parameter: AudioParam, value: number) => {
      if (smooth)
        parameter.setTargetAtTime(value, this.context!.currentTime, 0.06);
      else parameter.value = value;
    };
    set(
      voice.gain.gain,
      this.volume(voice.id) *
        voice.strength *
        voice.recordingGain *
        attenuation,
    );
    if (voice.panner)
      set(
        voice.panner.pan,
        Math.max(
          -0.85,
          Math.min(
            0.85,
            (dx * Math.cos(this.listener.yaw) -
              dz * Math.sin(this.listener.yaw)) /
              12,
          ),
        ),
      );
    if (voice.filter)
      set(voice.filter.frequency, 2_200 + 15_800 * Math.sqrt(attenuation));
  }
  private attenuation(id: string, distance: number) {
    return (
      this.profile.attenuation?.(id, distance) ??
      Math.max(0, Math.min(1, (24 - distance) / 20))
    );
  }
  private recordingGain(id: string, buffer: AudioBuffer) {
    if (!this.profile.recordingGain) return 1;
    let gains = this.recordingGains.get(buffer);
    if (!gains) {
      gains = new Map();
      this.recordingGains.set(buffer, gains);
    }
    if (!gains.has(id)) gains.set(id, this.profile.recordingGain(id, buffer));
    return gains.get(id)!;
  }
  variant(
    id: string,
    strength = 1,
    position?: { x: number; y?: number; z: number },
    sourceId?: string,
  ) {
    if (this.profile.availableVariants) {
      const available = [id, `${id}.1`, `${id}.2`, `${id}.3`].filter(
        (cue) => !!this.manifest.cues[cue],
      );
      const previous = this.variants.get(id) ?? -1;
      const choices = available
        .map((_, index) => index)
        .filter((index) => available.length === 1 || index !== previous);
      const choice = choices[Math.floor(Math.random() * choices.length)];
      if (choice !== undefined) {
        this.variants.set(id, choice);
        this.play(available[choice], strength, position, sourceId);
      } else if (id.startsWith('land.'))
        this.play('event.land', strength, position);
      return;
    }
    const previous = this.variants.get(id) ?? 0;
    const variant = 1 + ((previous + Math.floor(Math.random() * 2)) % 3);
    this.variants.set(id, variant);
    this.play(`${id}.${variant}`, strength, position, sourceId);
  }
  protected preferredCue(id: string, fallback: string) {
    return this.manifest.cues[id] ? id : fallback;
  }
  /** An urgent gameplay line takes over from incidental commentary. */
  protected interruptSpeech() {
    this.speechEpoch++;
    this.recent.delete('speech');
    for (const source of this.speechSources) {
      try {
        source.stop();
      } catch {}
    }
    this.speechSources.clear();
    this.speechCount = 0;
    this.mixLoops();
  }
  reset() {
    this.epoch++;
    this.interruptSpeech();
    this.recent.clear();
    this.sourcePositions.clear();
    this.spatialVoices.clear();
    for (const channel of this.loops.keys()) this.setLoop(channel, null);
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {}
    }
  }
  private visibility = () => {
    if (document.hidden) {
      this.epoch++;
      void this.context?.suspend().catch(() => {});
    } else if (this.context) this.unlock();
  };
  constructor(
    readonly game: GameId,
    private profile: AudioProfile = {},
  ) {
    this.manifest =
      this.profile.prepareManifest?.(this.manifest) ?? this.manifest;
    this.applyPreferences(audioPreferencesSnapshot());
    this.unregister = registerAudioListener(this);
    void this.refresh();
    this.timer = setInterval(() => {
      void this.refresh();
    }, 30_000);
    document.addEventListener('pointerdown', this.gesture);
    document.addEventListener('keydown', this.gesture);
    document.addEventListener('visibilitychange', this.visibility);
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
        this.masterGain(),
        this.context.currentTime,
        0.04,
      );
  }
  unlock() {
    if (this.disposed || document.hidden) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.masterGain();
        const compressor = this.context.createDynamicsCompressor();
        this.master.connect(compressor);
        compressor.connect(this.context.destination);
      }
      void this.context
        .resume()
        .then(() => {
          void this.warm();
          for (const [channel, entry] of this.loops)
            if (!entry.source) void this.startLoop(channel, entry);
        })
        .catch(() => {});
    } catch {
      /* Browser audio is optional. */
    }
  }
  async refresh() {
    try {
      const response = await fetch(`/api/audio/${this.game}?manifest=1`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok || this.disposed) return;
      const next = (await response.json()) as AudioManifest;
      if (this.disposed) return;
      const previous = this.manifest;
      this.manifest = this.profile.prepareManifest?.(next) ?? next;
      for (const voice of this.spatialVoices.values())
        this.mixSpatialVoice(voice, true);
      void this.warm();
      // setLoop removes and reinserts entries. Iterating the live Map would never finish.
      const activeLoops = [...this.loops];
      for (const [channel, entry] of activeLoops) {
        if (
          previous.cues[entry.id]?.url !== this.manifest.cues[entry.id]?.url
        ) {
          const id = entry.id;
          const level = this.loopLevels.get(channel) ?? 1;
          this.setLoop(channel, null);
          this.setLoop(channel, id, level);
        } else if (entry.gain && this.context)
          entry.gain.gain.setTargetAtTime(
            this.loopVolume(channel, entry.id),
            this.context.currentTime,
            0.1,
          );
      }
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
    return (
      cue.volume *
      this.manifest.settings[channel] *
      (channel === 'music'
        ? this.musicOn
          ? (this.profile.musicVolume ?? 1)
          : 0
        : channel === 'ambience'
          ? (this.profile.ambienceVolume ?? 1)
          : 1)
    );
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
          const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
          return this.profile.seamless?.(id, cue) &&
            cue.loop &&
            cue.category === 'ambience'
            ? seamlessAmbience(ctx, decoded)
            : decoded;
        } catch {
          return null;
        }
      })();
      this.buffers.set(cue.url, pending);
      if (this.buffers.size > (this.profile.bufferLimit ?? 24))
        this.buffers.delete(this.buffers.keys().next().value!);
      void pending.then((value) => {
        if (!value) this.buffers.delete(cue.url);
      });
    }
    return pending;
  }
  private async warm() {
    if (this.warming || !this.context || this.disposed || this.muted) return;
    this.warming = true;
    try {
      const ids = Object.keys(this.manifest.cues)
        .filter(
          (id) =>
            id.startsWith('step.') ||
            id === 'event.ui' ||
            (this.profile.preload?.(id) ?? false),
        )
        .slice(0, this.profile.warmLimit ?? 20);
      for (let i = 0; i < ids.length && !this.disposed; i += 3)
        await Promise.all(ids.slice(i, i + 3).map((id) => this.buffer(id)));
    } finally {
      this.warming = false;
    }
  }
  play(
    id: string,
    strength = 1,
    position?: { x: number; y?: number; z: number },
    sourceId?: string,
  ) {
    if (
      this.muted ||
      !this.context ||
      this.context.state !== 'running' ||
      this.disposed ||
      !this.manifest.cues[id] ||
      document.hidden
    )
      return;
    if (
      strength <= 0 ||
      (position &&
        Math.hypot(
          position.x - this.listener.x,
          (position.y ?? this.listener.y) - this.listener.y,
          position.z - this.listener.z,
        ) >= (this.profile.range?.(id) ?? 24))
    )
      return;
    const epoch = this.epoch,
      speechEpoch = this.speechEpoch,
      now = performance.now(),
      speech = id.startsWith('speech.'),
      cooldown = speech
        ? 'speech'
        : (this.profile.cooldownKey?.(id, sourceId) ?? id);
    if (now - (this.recent.get(cooldown) ?? -10_000) < (speech ? 2000 : 100))
      return;
    this.recent.set(cooldown, now);
    void this.buffer(id).then((buffer) => {
      if (
        !buffer ||
        epoch !== this.epoch ||
        (speech && speechEpoch !== this.speechEpoch) ||
        document.hidden ||
        (speech && this.speechCount > 0) ||
        this.disposed ||
        !this.context ||
        !this.master ||
        this.muted ||
        performance.now() - now > (speech ? 2000 : 350) ||
        this.sources.size >= (!speech ? (this.profile.effectLimit ?? 12) : 12)
      )
        return;
      if (sourceId && this.profile.trackSources) {
        const current = this.sourcePositions.get(sourceId);
        if (!current) return;
        position = current;
      }
      const source = this.context.createBufferSource(),
        gain = this.context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = this.profile.playbackRate?.(id) ?? 1;
      const distance = position
        ? Math.hypot(
            position.x - this.listener.x,
            (position.y ?? this.listener.y) - this.listener.y,
            position.z - this.listener.z,
          )
        : 0;
      const attenuation = this.attenuation(id, distance);
      if (attenuation <= 0) return;
      gain.gain.value =
        this.volume(id) *
        Math.max(0, Math.min(1, strength)) *
        attenuation *
        this.recordingGain(id, buffer);
      const panner = position ? this.context.createStereoPanner?.() : undefined;
      if (panner && position)
        panner.pan.value = Math.max(
          -0.85,
          Math.min(
            0.85,
            ((position.x - this.listener.x) * Math.cos(this.listener.yaw) -
              (position.z - this.listener.z) * Math.sin(this.listener.yaw)) /
              12,
          ),
        );
      const natural =
        (this.profile.natural?.(id) ?? false) &&
        !!position &&
        !speech &&
        !id.startsWith('music.');
      const filter = natural ? this.context.createBiquadFilter() : undefined;
      if (filter) {
        filter.type = 'lowpass';
        filter.frequency.value = 2_200 + 15_800 * Math.sqrt(attenuation);
        filter.Q.value = 0.5;
        source.connect(filter);
        filter.connect(gain);
        source.playbackRate.value = 0.98 + Math.random() * 0.04;
      } else source.connect(gain);
      if (panner) {
        gain.connect(panner);
        panner.connect(this.master);
      } else gain.connect(this.master);
      this.sources.add(source);
      if (this.profile.trackSources && position && !speech) {
        const voice = {
          id,
          position,
          sourceId,
          strength: Math.max(0, Math.min(1, strength)),
          recordingGain: this.recordingGain(id, buffer),
          source,
          gain,
          panner,
          filter,
        };
        this.spatialVoices.set(source, voice);
        this.mixSpatialVoice(voice);
      }
      if (speech) {
        this.speechSources.add(source);
        this.speechCount = this.speechSources.size;
        this.mixLoops();
      }
      source.onended = () => {
        this.sources.delete(source);
        this.spatialVoices.delete(source);
        source.disconnect();
        filter?.disconnect();
        gain.disconnect();
        panner?.disconnect();
        if (speech) {
          this.speechSources.delete(source);
          this.speechCount = this.speechSources.size;
          this.mixLoops();
        }
      };
      source.start();
    });
  }
  setLoop(channel: string, id: string | null, strength = 1) {
    // Keep the current score playing while a new track downloads and decodes.
    if (
      this.profile.crossfadeMusic &&
      channel === 'music' &&
      id &&
      this.context?.state === 'running' &&
      this.loops.get(channel)?.source &&
      this.loops.get(channel)?.id !== id
    ) {
      if (this.pendingMusic?.id === id) {
        this.pendingMusic.strength = strength;
        return;
      }
      const pending = { id, strength };
      this.pendingMusic = pending;
      void this.buffer(id).then((buffer) => {
        if (this.pendingMusic !== pending) return;
        this.pendingMusic = undefined;
        if (buffer && !this.disposed)
          this.changeLoop(channel, id, pending.strength);
      });
      return;
    }
    if (channel === 'music') this.pendingMusic = undefined;
    this.changeLoop(channel, id, strength);
  }
  private changeLoop(channel: string, id: string | null, strength: number) {
    this.loopLevels.set(channel, Math.max(0, Math.min(1, strength)));
    const previous = this.loops.get(channel);
    if (previous?.id === id) {
      if (previous.gain && this.context)
        previous.gain.gain.setTargetAtTime(
          this.loopVolume(channel, id!),
          this.context.currentTime,
          0.2,
        );
      return;
    }
    if (previous?.source) {
      const source = previous.source,
        gain = previous.gain;
      if (!this.disposed && gain && this.context) {
        gain.gain.setTargetAtTime(
          0,
          this.context.currentTime,
          this.profile.crossfadeMusic && channel === 'music' && id ? 0.4 : 0.08,
        );
        source.onended = () => {
          source.disconnect();
          gain.disconnect();
          this.sources.delete(source);
        };
        this.sources.add(source);
        source.stop(
          this.context.currentTime +
            (this.profile.crossfadeMusic && channel === 'music' && id
              ? 1.8
              : 0.35),
        );
      } else {
        source.stop();
        source.disconnect();
        gain?.disconnect();
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
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(
      this.loopVolume(channel, entry.id),
      this.context.currentTime,
      this.profile.crossfadeMusic && channel === 'music' ? 0.45 : 0.2,
    );
    source.connect(gain);
    gain.connect(this.master);
    entry.source = source;
    entry.gain = gain;
    source.start();
  }
  atmosphere(state: 'menu' | 'build' | 'challenge' | 'win' | 'fail') {
    this.setLoop('music', `music.${state}`);
    this.setLoop(
      'site',
      state === 'menu' ? null : 'ambience.site',
      this.profile.trackSources ? 0.75 : 1,
    );
    this.setLoop('trees', state === 'menu' ? null : 'ambience.trees');
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unregister();
    clearInterval(this.timer);
    document.removeEventListener('pointerdown', this.gesture);
    document.removeEventListener('keydown', this.gesture);
    document.removeEventListener('visibilitychange', this.visibility);
    for (const channel of this.loops.keys()) this.setLoop(channel, null);
    for (const source of this.sources) source.stop();
    this.sources.clear();
    this.spatialVoices.clear();
    this.sourcePositions.clear();
    this.buffers.clear();
    void this.context?.close();
  }
}
