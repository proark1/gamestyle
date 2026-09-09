import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteParticipant,
} from 'livekit-client';
import type { Session } from '../connection';
import type { Snapshot } from '../model';
export type VoiceState = {
  status: string;
  connected: boolean;
  mic: boolean;
  speaking: string[];
  level: number;
  error?: string;
};
type Peer = {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  record: GainNode;
  analyser: AnalyserNode;
  element: HTMLAudioElement;
};
export class VoiceClient {
  private room?: Room;
  private context?: AudioContext;
  private output?: MediaStreamAudioDestinationNode;
  private peers = new Map<string, Peer>();
  private volumes = new Map<string, number>();
  private selfSource?: MediaStreamAudioSourceNode;
  private selfRecord?: GainNode;
  private analyser?: AnalyserNode;
  private timer?: ReturnType<typeof setInterval>;
  private destroyed = false;
  private connecting = false;
  private snapshot?: Snapshot;
  private captureVoices = false;
  private micQueue: Promise<void> = Promise.resolve();
  private desiredMic = false;
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
      this.output = context.createMediaStreamDestination();
      await context.resume();
      const res = await fetch('/api/handwerker/voice/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.session),
        signal: AbortSignal.timeout(12000),
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
        await context.close();
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
      await room.startAudio();
      if (this.destroyed) {
        await room.disconnect();
        return;
      }
      this.timer = setInterval(() => this.mix(), 100);
      this.emit({ status: 'Connected · listening', connected: true });
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
  private add(track: RemoteTrack, participant: RemoteParticipant) {
    if (track.kind !== Track.Kind.Audio || !this.context) return;
    this.remove(participant.identity);
    const source = this.context.createMediaStreamSource(
      new MediaStream([track.mediaStreamTrack]),
    );
    const gain = this.context.createGain(),
      record = this.context.createGain(),
      analyser = this.context.createAnalyser();
    const element = track.attach() as HTMLAudioElement;
    element.muted = true;
    element.style.display = 'none';
    document.body.appendChild(element);
    source.connect(analyser);
    source.connect(gain);
    gain.connect(this.context.destination);
    gain.connect(record);
    record.connect(this.output!);
    record.gain.value = 0;
    this.peers.set(participant.identity, {
      source,
      gain,
      record,
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
    p.record.disconnect();
    p.analyser.disconnect();
    p.element.srcObject = null;
    p.element.remove();
    this.peers.delete(id);
  }
  microphone(enabled: boolean, deviceId?: string): Promise<void> {
    this.desiredMic = enabled;
    const request = this.micQueue.then(() =>
      this.setMicrophone(enabled, deviceId),
    );
    this.micQueue = request.catch(() => {});
    return request;
  }
  private async setMicrophone(enabled: boolean, deviceId?: string) {
    if (!this.room || !this.state.connected) return;
    if (enabled && (!this.desiredMic || this.destroyed)) return;
    try {
      if (deviceId) await this.room.switchActiveDevice('audioinput', deviceId);
      await this.room.localParticipant.setMicrophoneEnabled(enabled);
      if (enabled && !this.desiredMic) {
        await this.room.localParticipant.setMicrophoneEnabled(false);
        enabled = false;
      }
      this.selfSource?.disconnect();
      this.selfRecord?.disconnect();
      this.analyser?.disconnect();
      this.analyser = undefined;
      const track = this.room.localParticipant.getTrackPublication(
        Track.Source.Microphone,
      )?.track;
      if (enabled && track && this.context) {
        this.selfSource = this.context.createMediaStreamSource(
          new MediaStream([track.mediaStreamTrack]),
        );
        this.analyser = this.context.createAnalyser();
        this.selfRecord = this.context.createGain();
        this.selfSource.connect(this.analyser);
        this.selfSource.connect(this.selfRecord);
        this.selfRecord.connect(this.output!);
        this.selfRecord.gain.value = 0;
      }
      this.emit({ mic: enabled, level: 0, error: undefined });
      this.mix();
    } catch (error) {
      this.emit({
        error:
          error instanceof Error
            ? error.message
            : 'Microphone permission was not granted.',
      });
    }
  }
  async devices() {
    return (await navigator.mediaDevices.enumerateDevices()).filter(
      (d) => d.kind === 'audioinput',
    );
  }
  volume(id: string, value: number) {
    this.volumes.set(id, value);
    this.mix();
  }
  update(snapshot: Snapshot) {
    this.snapshot = snapshot;
    this.mix();
  }
  capture(enabled: boolean) {
    this.captureVoices = enabled;
    this.mix();
  }
  get captureStream() {
    return this.output?.stream;
  }
  private mix() {
    const s = this.snapshot,
      p = s?.world.party,
      me = s?.players.find((v) => v.id === this.session.id);
    for (const [id, peer] of this.peers) {
      const other = s?.players.find((v) => v.id === id);
      let level = this.volumes.get(id) ?? 1;
      if (!other) level = 0;
      if (
        p?.voiceMode === 'proximity' &&
        ['building', 'lastCall'].includes(p.phase) &&
        !p.radio[id] &&
        other &&
        me
      )
        level *= Math.min(
          1,
          Math.max(0, (18 - Math.hypot(me.x - other.x, me.z - other.z)) / 14),
        );
      peer.gain.gain.setTargetAtTime(level, this.context!.currentTime, 0.08);
      peer.record.gain.value =
        this.captureVoices && p?.audioConsent.includes(id) ? 1 : 0;
    }
    if (this.selfRecord)
      this.selfRecord.gain.value =
        this.captureVoices &&
        this.state.mic &&
        p?.audioConsent.includes(this.session.id)
          ? 1
          : 0;
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
    this.selfRecord?.disconnect();
    this.analyser?.disconnect();
    this.selfSource = undefined;
    this.selfRecord = undefined;
    this.analyser = undefined;
    const context = this.context;
    this.context = undefined;
    this.output = undefined;
    if (context && context.state !== 'closed') await context.close();
  }
  async dispose() {
    this.destroyed = true;
    this.desiredMic = false;
    const room = this.room;
    this.room = undefined;
    await room?.disconnect();
    await this.releaseAudio();
  }
}
