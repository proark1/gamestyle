import { acquireMesh, type PeerMesh } from '../peer/mesh';
import { PeerError } from '../peer/types';
import type { VoiceSession, VoiceSnapshot } from './types';
import type { VoiceState } from './client';

type PeerAudio = {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  analyser: AnalyserNode;
  values: Uint8Array<ArrayBuffer>;
  element: HTMLAudioElement;
};
export class VoiceClient {
  state: VoiceState = {
    status: 'Voice off',
    connected: false,
    mic: false,
    speaking: [],
    level: 0,
  };
  private context?: AudioContext;
  private mesh?: PeerMesh;
  private release?: () => void;
  private unsubscribe: (() => void)[] = [];
  private stream?: MediaStream;
  private source?: MediaStreamAudioSourceNode;
  private analyser?: AnalyserNode;
  private peers = new Map<string, PeerAudio>();
  private snapshot?: VoiceSnapshot;
  private volumes = new Map<string, number>();
  private deafened = false;
  private destroyed = false;
  private desired = false;
  private queue: Promise<unknown> = Promise.resolve();
  private timer?: ReturnType<typeof setInterval>;
  constructor(
    readonly session: VoiceSession,
    private changed: (state: VoiceState) => void,
  ) {}
  private emit(patch: Partial<VoiceState>) {
    if (this.destroyed) return;
    this.state = { ...this.state, ...patch };
    this.changed(this.state);
  }
  async connect() {
    if (this.mesh || this.destroyed) return;
    this.emit({ status: 'Connecting…', error: undefined });
    try {
      const context = new AudioContext();
      this.context = context;
      context.onstatechange = () =>
        this.emit({ audioBlocked: context.state !== 'running' });
      void context.resume().catch(() => this.emit({ audioBlocked: true }));
      const lease = acquireMesh({ ...this.session, peer: true });
      this.mesh = lease.mesh;
      this.release = lease.release;
      this.unsubscribe.push(
        this.mesh.on('track', (id, track) => {
          this.remove(id);
          if (track) this.add(id, track);
        }),
        this.mesh.on('error', (error) => {
          if (error instanceof PeerError && error.status === 401) {
            this.emit({
              status: 'Disconnected',
              connected: false,
              mic: false,
              error: error.message,
            });
            void this.dispose();
          }
        }),
      );
      for (const [id, track] of this.mesh.tracks) this.add(id, track);
      this.mesh.start();
      this.timer = setInterval(() => this.mix(), 100);
      this.emit({
        status: 'Connected',
        connected: true,
        audioBlocked: context.state !== 'running',
      });
    } catch {
      this.emit({
        status: 'Voice unavailable',
        connected: false,
        error:
          'Voice could not start. Use an up-to-date browser and try again.',
      });
      await this.dispose();
    }
  }
  private add(id: string, track: MediaStreamTrack) {
    if (!this.context || this.destroyed) return;
    const stream = new MediaStream([track]);
    const element = document.createElement('audio');
    element.muted = true;
    element.autoplay = true;
    element.srcObject = stream;
    element.style.display = 'none';
    document.body.appendChild(element);
    void element.play().catch(() => {});
    const source = this.context.createMediaStreamSource(stream),
      gain = this.context.createGain(),
      analyser = this.context.createAnalyser();
    source.connect(analyser);
    source.connect(gain);
    gain.connect(this.context.destination);
    this.peers.set(id, {
      source,
      gain,
      analyser,
      values: new Uint8Array(analyser.fftSize),
      element,
    });
    this.mix();
  }
  private remove(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.source.disconnect();
    peer.gain.disconnect();
    peer.analyser.disconnect();
    peer.element.srcObject = null;
    peer.element.remove();
    this.peers.delete(id);
  }
  microphone(enabled: boolean, deviceId?: string): Promise<void> {
    this.desired = enabled;
    if (!enabled)
      for (const track of this.stream?.getTracks() ?? []) track.enabled = false;
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        if (
          this.destroyed ||
          !this.mesh ||
          !this.state.connected ||
          (enabled && !this.desired)
        )
          return;
        if (!enabled) {
          await this.mesh.microphone(null).catch(() => {});
          this.stopMicrophone();
          this.emit({ mic: false, level: 0 });
          return;
        }
        let stream: MediaStream | undefined;
        const mesh = this.mesh;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
            },
            video: false,
          });
          if (this.destroyed || !this.desired) {
            for (const track of stream.getTracks()) track.stop();
            return;
          }
          const track = stream.getAudioTracks()[0];
          await mesh.microphone(track);
          if (this.destroyed || !this.desired) {
            for (const track of stream.getTracks()) track.stop();
            await mesh.microphone(null).catch(() => {});
            return;
          }
          this.stopMicrophone();
          this.stream = stream;
          if (this.context) {
            this.source = this.context.createMediaStreamSource(stream);
            this.analyser = this.context.createAnalyser();
            this.source.connect(this.analyser);
          }
          track.onended = () => {
            if (this.stream === stream) {
              this.desired = false;
              void this.microphone(false);
            }
          };
          this.emit({ mic: true, error: undefined });
        } catch {
          this.desired = false;
          for (const track of stream?.getTracks() ?? []) track.stop();
          this.stopMicrophone();
          await mesh.microphone(null).catch(() => {});
          this.emit({
            mic: false,
            error:
              'Microphone access is unavailable. Check your browser permissions and microphone, then enable it again. You can still listen.',
          });
        }
      });
    this.queue = task;
    return task;
  }
  private stopMicrophone() {
    for (const track of this.stream?.getTracks() ?? []) {
      track.onended = null;
      track.stop();
    }
    this.stream = undefined;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.source = undefined;
    this.analyser = undefined;
  }
  async prepareMicrophone(deviceId?: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      });
      for (const track of stream.getTracks()) track.stop();
      if (this.destroyed || !this.state.connected) return false;
      this.emit({ error: undefined });
      return true;
    } catch {
      this.emit({
        error:
          'Allow microphone access in your browser settings, then enable it again.',
      });
      return false;
    }
  }
  async devices() {
    return (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === 'audioinput',
    );
  }
  async resumeAudio() {
    if (!this.context || this.destroyed) return;
    try {
      await this.context.resume();
      this.emit({ audioBlocked: this.context.state !== 'running' });
    } catch {
      this.emit({ audioBlocked: true });
    }
  }
  update(snapshot: VoiceSnapshot) {
    this.snapshot = snapshot;
    this.mix();
  }
  volume(id: string, value: number) {
    this.volumes.set(id, Math.max(0, Math.min(1, value)));
    this.mix();
  }
  deafen(value: boolean) {
    this.deafened = value;
    this.mix();
  }
  private mix() {
    if (!this.context || this.destroyed) return;
    const members =
      this.mesh?.view?.members.filter((m) => m.id !== this.session.id) ?? [];
    const missing = members.filter(
      (m) => this.mesh?.links.get(m.id)?.pc.connectionState !== 'connected',
    );
    const status = missing.length ? 'Connecting to players…' : 'Connected';
    if (this.state.status !== status) this.emit({ status });
    const speaking: string[] = [],
      me = this.snapshot?.players.find((p) => p.id === this.session.id);
    for (const [id, peer] of this.peers) {
      const other = this.snapshot?.players.find((p) => p.id === id);
      let volume = this.deafened || !other ? 0 : (this.volumes.get(id) ?? 1);
      if (
        this.snapshot?.nearby &&
        this.session.game === 'stack-or-sink' &&
        me?.x !== undefined &&
        me.z !== undefined &&
        other?.x !== undefined &&
        other.z !== undefined
      )
        volume *= Math.min(
          1,
          Math.max(0, (24 - Math.hypot(me.x - other.x, me.z - other.z)) / 20),
        );
      peer.gain.gain.setTargetAtTime(volume, this.context.currentTime, 0.08);
      peer.analyser.getByteTimeDomainData(peer.values);
      const rms = Math.sqrt(
        peer.values.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) /
          peer.values.length,
      );
      if (volume > 0 && rms > 0.015) speaking.push(id);
    }
    let level = 0;
    if (this.analyser && this.state.mic) {
      const values = new Uint8Array(this.analyser.fftSize);
      this.analyser.getByteTimeDomainData(values);
      level = Math.min(
        1,
        Math.sqrt(
          values.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) /
            values.length,
        ) * 4,
      );
      if (level > 0.06) speaking.push(this.session.id);
    }
    if (
      level !== this.state.level ||
      speaking.join() !== this.state.speaking.join()
    )
      this.emit({ speaking, level });
  }
  async dispose() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.desired = false;
    clearInterval(this.timer);
    this.stopMicrophone();
    await this.mesh?.microphone(null).catch(() => {});
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    for (const id of this.peers.keys()) this.remove(id);
    if (this.context) {
      this.context.onstatechange = null;
      if (this.context.state !== 'closed') await this.context.close();
    }
    this.release?.();
    this.context = undefined;
    this.mesh = undefined;
    this.state = {
      status: 'Voice off',
      connected: false,
      mic: false,
      speaking: [],
      level: 0,
    };
  }
}
