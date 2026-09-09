import {
  PeerError,
  type DeliveredSignal,
  type Member,
  type PeerReply,
  type PeerSession,
  type PeerView,
  type Signal,
} from './types';

export async function peerRequest(
  body: object,
  keepalive = false,
): Promise<PeerReply> {
  const response = await fetch('/api/peer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
    keepalive,
  });
  const reply = (await response.json()) as PeerReply & { error?: string };
  if (!response.ok)
    throw new PeerError(
      reply.error ?? 'The room could not connect.',
      response.status,
    );
  return reply;
}
type Link = {
  id: string;
  member: Member;
  pc: RTCPeerConnection;
  channel?: RTCDataChannel;
  sender: RTCRtpSender;
  created: number;
  candidates: RTCIceCandidateInit[];
  chunks: Map<
    string,
    { at: number; parts: string[]; size: number; total: number }
  >;
};
type Listeners = {
  view: (view: PeerView) => void;
  message: (id: string, message: unknown) => void;
  track: (id: string, track: MediaStreamTrack | null) => void;
  error: (error: Error) => void;
  connected: (id: string) => void;
};
export class PeerMesh {
  readonly instance = crypto.randomUUID();
  view?: PeerView;
  validUntil = 0;
  links = new Map<string, Link>();
  tracks = new Map<string, MediaStreamTrack>();
  private listeners: { [K in keyof Listeners]: Set<Listeners[K]> } = {
    view: new Set(),
    message: new Set(),
    track: new Set(),
    error: new Set(),
    connected: new Set(),
  };
  private localTrack: MediaStreamTrack | null = null;
  private started = false;
  private closed = false;
  private cursor = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private signalQueue: Promise<unknown> = Promise.resolve();
  private outbox: Signal[] = [];
  private heartbeat?: ReturnType<typeof setTimeout>;
  private flushTimer?: ReturnType<typeof setTimeout>;
  constructor(readonly session: PeerSession) {}
  on<K extends keyof Listeners>(event: K, listener: Listeners[K]) {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }
  private error(error: unknown) {
    if (this.closed) return;
    const value =
      error instanceof Error
        ? error
        : new Error('Peer connection interrupted.');
    for (const listener of this.listeners.error) listener(value);
    if (value instanceof PeerError && value.status === 401) this.close();
  }
  start() {
    if (this.started || this.closed) return;
    this.started = true;
    void this.rpc('hello')
      .then(() => this.poll())
      .catch((error) => {
        this.error(error);
        this.started = false;
        if (!this.closed) this.heartbeat = setTimeout(() => this.start(), 1000);
      });
  }
  private async poll() {
    if (this.closed) return;
    try {
      await this.rpc('poll');
    } catch (error) {
      this.error(error);
    }
    if (!this.closed) this.heartbeat = setTimeout(() => void this.poll(), 1000);
  }
  rpc(op: string, extra: object = {}) {
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        if (this.closed)
          throw new PeerError('This room connection has closed.', 401);
        const started = performance.now();
        const reply = await peerRequest({
          ...this.session,
          instance: this.instance,
          cursor: this.cursor,
          epoch: this.view?.epoch,
          op,
          ...extra,
        });
        if (this.closed) return reply.view;
        if (!this.view || reply.view.epoch >= this.view.epoch) {
          this.validUntil =
            performance.now() +
            Math.max(
              0,
              reply.view.leaseUntil -
                reply.view.now -
                (performance.now() - started),
            );
          this.view = reply.view;
          this.cursor = Math.max(this.cursor, reply.view.cursor);
          this.reconcile();
          for (const listener of this.listeners.view) listener(reply.view);
          for (const signal of reply.view.signals)
            this.signalQueue = this.signalQueue
              .catch(() => {})
              .then(() => this.receiveSignal(signal))
              .catch((error) => this.error(error));
        }
        return reply.view;
      });
    this.queue = task;
    return task;
  }
  private reconcile() {
    if (!this.view || this.closed) return;
    const self = this.view.members.find((m) => m.id === this.session.id);
    if (!self) return;
    for (const [id, link] of this.links) {
      const member = this.view.members.find((m) => m.id === id);
      if (!member || member.instance !== link.member.instance) this.remove(id);
      else if (
        self.order < member.order &&
        (link.pc.connectionState === 'failed' ||
          (link.channel?.readyState !== 'open' &&
            performance.now() - link.created > 10000))
      )
        this.remove(id);
    }
    for (const member of this.view.members)
      if (
        member.instance &&
        member.id !== self.id &&
        self.order < member.order &&
        !this.links.has(member.id)
      ) {
        const link = this.create(member, crypto.randomUUID(), true);
        void (async () => {
          await link.pc.setLocalDescription(await link.pc.createOffer());
          if (this.links.get(member.id) === link)
            this.signal(link, {
              description: link.pc.localDescription!.toJSON(),
            });
        })().catch((error) => this.error(error));
      }
  }
  private create(member: Member, id: string, initiator: boolean) {
    const pc = new RTCPeerConnection({
      iceServers: this.view?.iceServers ?? [],
    });
    const sender = pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;
    const link: Link = {
      id,
      pc,
      sender,
      member,
      created: performance.now(),
      candidates: [],
      chunks: new Map(),
    };
    this.links.set(member.id, link);
    if (this.localTrack)
      void sender
        .replaceTrack(this.localTrack)
        .catch((error) => this.error(error));
    pc.onicecandidate = (event) => {
      if (event.candidate)
        this.signal(link, { candidate: event.candidate.toJSON() });
    };
    pc.ondatachannel = (event) => this.attachChannel(link, event.channel);
    pc.ontrack = (event) => {
      if (event.track.kind !== 'audio' || this.links.get(member.id) !== link)
        return;
      this.tracks.set(member.id, event.track);
      for (const listener of this.listeners.track)
        listener(member.id, event.track);
    };
    if (initiator)
      this.attachChannel(link, pc.createDataChannel('game', { ordered: true }));
    return link;
  }
  private attachChannel(link: Link, channel: RTCDataChannel) {
    if (channel.label !== 'game' || link.channel) {
      channel.close();
      return;
    }
    link.channel = channel;
    channel.onopen = () => {
      for (const listener of this.listeners.connected) listener(link.member.id);
    };
    channel.onmessage = (event) => {
      if (
        this.closed ||
        this.links.get(link.member.id) !== link ||
        typeof event.data !== 'string' ||
        event.data.length > 18000
      )
        return;
      try {
        const message = JSON.parse(event.data);
        if (message?.chunk === true) {
          if (
            typeof message.id !== 'string' ||
            message.id.length > 80 ||
            !Number.isInteger(message.index) ||
            !Number.isInteger(message.total) ||
            message.total < 1 ||
            message.total > 32 ||
            message.index < 0 ||
            message.index >= message.total ||
            typeof message.data !== 'string'
          )
            return;
          for (const [id, chunk] of link.chunks)
            if (performance.now() - chunk.at > 5000) link.chunks.delete(id);
          let chunk = link.chunks.get(message.id);
          if (!chunk) {
            if (link.chunks.size >= 4) return;
            chunk = {
              at: performance.now(),
              parts: [],
              total: message.total,
              size: 0,
            };
            link.chunks.set(message.id, chunk);
          }
          if (
            chunk.total !== message.total ||
            chunk.parts[message.index] !== undefined
          )
            return;
          chunk.parts[message.index] = message.data;
          chunk.size += message.data.length;
          if (chunk.size > 280000) {
            link.chunks.delete(message.id);
            return;
          }
          if (
            Array.from({ length: chunk.total }, (_, i) => chunk.parts[i]).every(
              (p) => typeof p === 'string',
            )
          ) {
            link.chunks.delete(message.id);
            for (const listener of this.listeners.message)
              listener(link.member.id, JSON.parse(chunk.parts.join('')));
          }
        } else
          for (const listener of this.listeners.message)
            listener(link.member.id, message);
      } catch {
        /* Ignore malformed peer packets. */
      }
    };
  }
  private signal(
    link: Link,
    payload: {
      description?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    },
  ) {
    if (this.closed || this.links.get(link.member.id) !== link) return;
    this.outbox.push({
      id: crypto.randomUUID(),
      to: link.member.id,
      instance: link.member.instance,
      link: link.id,
      ...payload,
    });
    if (!this.flushTimer)
      this.flushTimer = setTimeout(() => void this.flushSignals(), 30);
  }
  private async flushSignals() {
    this.flushTimer = undefined;
    if (this.closed || !this.outbox.length) return;
    const signals = this.outbox.splice(0, 32);
    try {
      await this.rpc('signal', { signals });
    } catch (error) {
      this.outbox.unshift(...signals);
      this.outbox = this.outbox.slice(-192);
      this.error(error);
    }
    if (!this.closed && this.outbox.length && !this.flushTimer)
      this.flushTimer = setTimeout(() => void this.flushSignals(), 250);
  }
  private async receiveSignal(signal: DeliveredSignal) {
    if (this.closed || signal.instance !== this.instance) return;
    const member = this.view?.members.find(
      (m) => m.id === signal.from && m.instance === signal.fromInstance,
    );
    const self = this.view?.members.find((m) => m.id === this.session.id);
    if (!member || !self) return;
    let link = this.links.get(member.id);
    if (signal.description?.type === 'offer') {
      if (member.order >= self.order) return;
      if (link?.id !== signal.link) {
        this.remove(member.id);
        link = this.create(member, signal.link, false);
      }
      if (link.pc.remoteDescription) return;
      await link.pc.setRemoteDescription(signal.description);
      for (const candidate of link.candidates.splice(0))
        await link.pc.addIceCandidate(candidate);
      await link.pc.setLocalDescription(await link.pc.createAnswer());
      this.signal(link, { description: link.pc.localDescription!.toJSON() });
    } else if (signal.description?.type === 'answer') {
      if (
        !link ||
        link.id !== signal.link ||
        member.order <= self.order ||
        link.pc.signalingState !== 'have-local-offer'
      )
        return;
      await link.pc.setRemoteDescription(signal.description);
      for (const candidate of link.candidates.splice(0))
        await link.pc.addIceCandidate(candidate);
    } else if (signal.candidate) {
      // Trickle candidates can precede an offer. Hold them on the matching receiving link.
      if (!link && member.order < self.order)
        link = this.create(member, signal.link, false);
      if (!link || link.id !== signal.link) return;
      if (link.pc.remoteDescription)
        await link.pc.addIceCandidate(signal.candidate);
      else if (link.candidates.length < 64)
        link.candidates.push(signal.candidate);
    }
  }
  send(id: string, message: unknown): boolean {
    const channel = this.links.get(id)?.channel;
    if (
      this.closed ||
      channel?.readyState !== 'open' ||
      channel.bufferedAmount > 256000
    )
      return false;
    const text = JSON.stringify(message);
    if (text.length > 260000) return false;
    try {
      if (text.length <= 8000) channel.send(text);
      else {
        const key = crypto.randomUUID(),
          total = Math.ceil(text.length / 8000);
        for (let index = 0; index < total; index++)
          channel.send(
            JSON.stringify({
              chunk: true,
              id: key,
              index,
              total,
              data: text.slice(index * 8000, (index + 1) * 8000),
            }),
          );
      }
      return true;
    } catch {
      return false;
    }
  }
  async microphone(track: MediaStreamTrack | null) {
    if (this.closed) {
      track?.stop();
      if (track) throw new PeerError('This room connection has closed.', 401);
      return;
    }
    this.localTrack = track;
    await Promise.all(
      [...this.links.values()].map(async (link) => {
        try {
          await link.sender.replaceTrack(track);
        } catch (error) {
          // A departure can close a sender while the microphone is being switched.
          if (this.links.get(link.member.id) === link && !this.closed)
            throw error;
        }
      }),
    );
  }
  private remove(id: string) {
    const link = this.links.get(id);
    this.links.delete(id);
    if (link) {
      link.pc.onicecandidate = null;
      link.pc.ontrack = null;
      link.channel?.close();
      link.pc.close();
    }
    this.tracks.delete(id);
    for (const listener of this.listeners.track) listener(id, null);
  }
  async leave() {
    if (this.closed) return;
    try {
      await this.rpc('leave');
    } finally {
      this.close();
    }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.validUntil = 0;
    clearTimeout(this.heartbeat);
    clearTimeout(this.flushTimer);
    this.localTrack?.stop();
    this.localTrack = null;
    for (const id of this.links.keys()) this.remove(id);
  }
}
const meshes = new Map<string, { mesh: PeerMesh; refs: number }>();
export function acquireMesh(session: PeerSession) {
  const key = `${session.game}:${session.code}:${session.id}:${session.token}`;
  let entry = meshes.get(key);
  if (!entry) {
    entry = { mesh: new PeerMesh(session), refs: 0 };
    meshes.set(key, entry);
  }
  entry.refs++;
  let released = false;
  return {
    mesh: entry.mesh,
    release: () => {
      if (released) return;
      released = true;
      entry.refs--;
      if (entry.refs === 0) {
        entry.mesh.close();
        meshes.delete(key);
      }
    },
  };
}
