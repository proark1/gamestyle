import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteParticipant,
} from 'livekit-client';
import type {
  VoiceSession as Session,
  VoiceSnapshot as Snapshot,
} from './types';
export type VoiceState = {
  status: string;
  connected: boolean;
  mic: boolean;
  speaking: string[];
  level: number;
  error?: string;
  audioBlocked?: boolean;
};
type Peer = {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  analyser: AnalyserNode;
  element: HTMLAudioElement;
};
export class VoiceClient {
  private room?: Room;
  private context?: AudioContext;
  private peers = new Map<string, Peer>();
  private volumes = new Map<string, number>();
  private selfSource?: MediaStreamAudioSourceNode;
  private analyser?: AnalyserNode;
  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;
  private connecting = false;
  private snapshot?: Snapshot;
  private deafened = false;
  private micQueue: Promise<void> = Promise.resolve();
  private desiredMic = false;
  private abort = new AbortController();
  state: VoiceState = {
    status: 'Voice off',
    connected: false,
    mic: false,
    speaking: [],
    level: 0,
  };
  constructor(
    readonly session: Session,
    private changed: (state: VoiceState) => void,
  ) {}
  private emit(patch: Partial<VoiceState>) {
    if (this.destroyed) return;
    this.state = { ...this.state, ...patch };
    this.changed(this.state);
  }
  async connect() {
    if (this.room || this.destroyed || this.connecting) return;
    this.connecting = true;
    this.emit({ status: 'Connecting…', error: undefined });
    try {
      const context = new AudioContext();
      this.context = context;
      context.onstatechange = () => {
        if (this.context === context)
          this.emit({ audioBlocked: context.state !== 'running' });
      };
      // Autoplay can wait for another gesture. It must not stall room joining.
      void context.resume().catch(() => this.emit({ audioBlocked: true }));
      const res = await fetch('/api/voice/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.session),
        signal: AbortSignal.any([
          this.abort.signal,
          AbortSignal.timeout(12000),
        ]),
      });
      const data = (await res.json()) as {
        configured: boolean;
        error?: string;
        message?: string;
        url: string;
        token: string;
      };
      if (!res.ok) throw new Error(data.error || 'Voice unavailable.');
      if (!data.configured) throw new Error(data.message);
      if (this.destroyed) {
        return;
      }
      const room = new Room({
        adaptiveStream: false,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.room = room;
      room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) =>
        this.add(track, participant),
      );
      room.on(
        RoomEvent.TrackUnsubscribed,
        (_track, _publication, participant) =>
          this.remove(participant.identity),
      );
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) =>
        this.emit({ speaking: speakers.map((v) => v.identity) }),
      );
      room.on(RoomEvent.Reconnecting, () =>
        this.emit({ status: 'Reconnecting…' }),
      );
      room.on(RoomEvent.Reconnected, () =>
        this.emit({ status: 'Connected', connected: true }),
      );
      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.source === Track.Source.Microphone) {
          this.desiredMic = false;
          this.emit({ mic: false, level: 0 });
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        if (this.room !== room) return;
        this.room = undefined;
        this.desiredMic = false;
        void this.releaseAudio();
        this.emit({
          status: 'Disconnected',
          connected: false,
          mic: false,
          speaking: [],
          level: 0,
        });
      });
      await room.connect(data.url, data.token);
      if (this.destroyed || this.room !== room) {
        await room.disconnect();
        return;
      }
      this.timer = setInterval(() => this.mix(), 100);
      this.emit({
        status: 'Connected',
        connected: true,
        audioBlocked: context.state !== 'running',
      });
    } catch (error) {
      const room = this.room;
      this.room = undefined;
      await room?.disconnect();
      await this.releaseAudio();
      this.emit({
        status: 'Voice unavailable',
        connected: false,
        mic: false,
        error:
          error instanceof Error ? error.message : 'Voice could not connect.',
      });
    } finally {
      this.connecting = false;
    }
  }
  async resumeAudio() {
    const context = this.context;
    if (!context || this.destroyed) return;
    try {
      await context.resume();
      this.emit({ audioBlocked: context.state !== 'running' });
    } catch {
      this.emit({ audioBlocked: true });
    }
  }
  private add(track: RemoteTrack, participant: RemoteParticipant) {
    if (track.kind !== Track.Kind.Audio || !this.context) return;
    this.remove(participant.identity);
    const source = this.context.createMediaStreamSource(
      new MediaStream([track.mediaStreamTrack]),
    );
    const gain = this.context.createGain(),
      analyser = this.context.createAnalyser();
    const element = track.attach() as HTMLAudioElement;
    element.muted = true;
    element.style.display = 'none';
    document.body.appendChild(element);
    source.connect(analyser);
    source.connect(gain);
    gain.connect(this.context.destination);
    this.peers.set(participant.identity, {
      source,
      gain,
      analyser,
      element,
    });
    this.mix();
  }
  private remove(id: string) {
    const p = this.peers.get(id);
    if (!p) return;
    p.source.disconnect();
    p.gain.disconnect();
    p.analyser.disconnect();
    p.element.srcObject = null;
    p.element.remove();
    this.peers.delete(id);
  }
  microphone(enabled: boolean, deviceId?: string): Promise<void> {
    this.desiredMic = enabled;
    // Stop transmission immediately, even while an earlier device switch is pending.
    if (!enabled) {
      const mediaTrack = this.room?.localParticipant.getTrackPublication?.(
        Track.Source.Microphone,
      )?.track?.mediaStreamTrack;
      if (mediaTrack) mediaTrack.enabled = false;
    }
    const request = this.micQueue.then(() =>
      this.setMicrophone(enabled, deviceId),
    );
    this.micQueue = request.catch(() => {});
    return request;
  }
  private async setMicrophone(enabled: boolean, deviceId?: string) {
    if (!this.room || !this.state.connected) return;
    const room = this.room;
    if (enabled && (!this.desiredMic || this.destroyed)) return;
    try {
      if (enabled && deviceId)
        await room.switchActiveDevice('audioinput', deviceId);
      if (enabled && (!this.desiredMic || this.destroyed || this.room !== room))
        return;
      await room.localParticipant.setMicrophoneEnabled(enabled);
      if (
        enabled &&
        (!this.desiredMic || this.destroyed || this.room !== room)
      ) {
        await room.localParticipant.setMicrophoneEnabled(false);
        enabled = false;
      }
      if (this.destroyed || this.room !== room) return;
      this.selfSource?.disconnect();
      this.selfSource = undefined;
      this.analyser?.disconnect();
      this.analyser = undefined;
      const track = room.localParticipant.getTrackPublication(
        Track.Source.Microphone,
      )?.track;
      if (enabled && track && this.context) {
        track.mediaStreamTrack.enabled = true;
        this.selfSource = this.context.createMediaStreamSource(
          new MediaStream([track.mediaStreamTrack]),
        );
        this.analyser = this.context.createAnalyser();
        this.selfSource.connect(this.analyser);
      }
      this.emit({ mic: enabled, level: 0, error: undefined });
      this.mix();
    } catch (error) {
      if (this.destroyed || this.room !== room) return;
      this.emit({
        mic: enabled ? this.state.mic : false,
        level: 0,
        error:
          error instanceof Error && error.name === 'NotAllowedError'
            ? 'Microphone access is blocked. Allow it in your browser settings, then enable the microphone again. You can still listen.'
            : 'Your microphone could not start. Check that it is connected and allowed in your browser, then try again.',
      });
    }
  }
  async devices() {
    return (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === 'audioinput',
    );
  }
  async prepareMicrophone(deviceId?: string) {
    // Acquire permission locally for push-to-talk without publishing a live track.
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
          'Microphone permission was not granted. Check browser permissions and try again.',
      });
      return false;
    }
  }
  volume(id: string, value: number) {
    this.volumes.set(id, Math.max(0, Math.min(1, value)));
    this.mix();
  }
  update(snapshot: Snapshot) {
    this.snapshot = snapshot;
    this.mix();
  }
  deafen(value: boolean) {
    this.deafened = value;
    this.mix();
  }
  private mix() {
    const s = this.snapshot,
      me = s?.players.find((v) => v.id === this.session.id);
    for (const [id, peer] of this.peers) {
      const other = s?.players.find((v) => v.id === id);
      let level = this.deafened || !other ? 0 : (this.volumes.get(id) ?? 1);
      if (
        s?.nearby &&
        this.session.game === 'stack-or-sink' &&
        other &&
        me &&
        me.x !== undefined &&
        me.z !== undefined &&
        other.x !== undefined &&
        other.z !== undefined
      )
        level *= Math.min(
          1,
          Math.max(0, (24 - Math.hypot(me.x - other.x, me.z - other.z)) / 20),
        );
      peer.gain.gain.setTargetAtTime(level, this.context!.currentTime, 0.08);
    }
    if (this.analyser && this.state.mic) {
      const values = new Uint8Array(this.analyser.fftSize);
      this.analyser.getByteTimeDomainData(values);
      const level = Math.sqrt(
        values.reduce((n, v) => n + ((v - 128) / 128) ** 2, 0) / values.length,
      );
      this.emit({ level: Math.min(1, level * 4) });
    }
  }
  private async releaseAudio() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    for (const id of this.peers.keys()) this.remove(id);
    this.selfSource?.disconnect();
    this.analyser?.disconnect();
    this.selfSource = undefined;
    this.analyser = undefined;
    const context = this.context;
    this.context = undefined;
    if (context) context.onstatechange = null;
    if (context && context.state !== 'closed') await context.close();
  }
  async dispose() {
    this.destroyed = true;
    this.abort.abort();
    this.desiredMic = false;
    this.state = {
      status: 'Voice off',
      connected: false,
      mic: false,
      speaking: [],
      level: 0,
    };
    const room = this.room;
    this.room = undefined;
    await room?.disconnect();
    await this.releaseAudio();
  }
}
