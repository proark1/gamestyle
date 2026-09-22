import { DurableBatch } from './durable-batch';
import {
  SnapshotSender,
  SnapshotReceiver,
  type StatePacket,
} from './snapshot-codec';
import type { GameId } from '../audio/types';
import type { Session } from '../rooms/session';
import type {
  PeerRuntime,
  GameSnapshot,
  EngineCheckpoint,
  EngineLoader,
} from './engine';
import { openCheckpoint, sealCheckpoint } from './crypto';
import { acquireMesh, peerRequest, type PeerMesh } from './mesh';
import { PeerError, type PeerView } from './types';
import type { NpcAction } from '../rooms/npc-slots';
import { bindGameLifecycle } from '../browser/game-lifecycle';

export async function enterPeerRoom<S>(
  game: GameId,
  body: object,
  loadEngine: EngineLoader,
): Promise<{ session?: Session; snapshot?: S }> {
  if (typeof RTCPeerConnection === 'undefined')
    throw new Error(
      'This browser cannot connect to player-hosted games. Use an up-to-date browser.',
    );
  const reply = await peerRequest({ ...body, game });
  const { createEngine } = await loadEngine();
  const preview = createEngine(reply.view.now);
  preview.reconcile(reply.view.members, reply.view.npcs);
  return {
    session: reply.session,
    snapshot: preview.snapshot(
      reply.view.code,
      reply.view.host,
      reply.session!.id,
      reply.view.epoch,
    ) as S,
  };
}
type PendingAction = {
  action: unknown;
  resolve: () => void;
  reject: (error: Error) => void;
  until: number;
  sent: number;
};
type Packet = {
  type: string;
  base?: number;
  version?: number;
  changes?: unknown;
  epoch: number;
  order?: number;
  input?: unknown;
  action?: unknown;
  requestId?: string;
  error?: string;
  snapshot?: GameSnapshot;
};
export class PeerGameConnection<S> {
  readonly diagnostics = {
    simulationMs: 0,
    snapshotMs: 0,
    encodingMs: 0,
    checkpointMs: 0,
    tickMs: 0,
  };
  private diagnosticAt = 0;
  private mesh: PeerMesh;
  private release: () => void;
  private unsubscribe: (() => void)[] = [];
  private engine?: PeerRuntime;
  private recovery?: PeerView['checkpoint'];
  private epoch = 0;
  private restoring = false;
  private partyStarting = false;
  private stopped = false;
  private started = false;
  private leaving = false;
  private timer?: ReturnType<typeof setInterval>;
  private order = 0;
  private receivedAt = 0;
  private receivedVersion = -1;
  private lastTick = 0;
  private lastSave = 0;
  private saving = false;
  private durability = new DurableBatch(() => this.saveCheckpoint());
  private encoders = new Map<string, SnapshotSender>();
  private decoder = new SnapshotReceiver();
  private lastResync = -Infinity;
  private actionQueue: Promise<unknown> = Promise.resolve();
  private pending = new Map<string, PendingAction>();
  private processing = new Set<string>();
  private statusValue = '';
  constructor(
    readonly game: GameId,
    readonly session: Session,
    private readInput: () => unknown,
    private receive: (snapshot: S) => void,
    private setStatus: (status: 'online' | 'reconnecting' | 'expired') => void,
    private loadEngine: EngineLoader,
  ) {
    const lease = acquireMesh({ ...session, game, peer: true });
    this.mesh = lease.mesh;
    this.release = lease.release;
  }
  private status(value: 'online' | 'reconnecting' | 'expired') {
    if (value !== this.statusValue && !this.stopped) {
      this.statusValue = value;
      this.setStatus(value);
    }
  }
  start() {
    if (this.started || this.stopped) return;
    this.started = true;
    this.status('reconnecting');
    this.lastTick = performance.now();
    this.unsubscribe.push(
      this.mesh.on('view', (view) => this.onView(view)),
      this.mesh.on('message', (id, message) => this.onMessage(id, message)),
      this.mesh.on('connected', (id) => this.encoders.get(id)?.reset()),
      this.mesh.on('error', (error) => {
        if (error instanceof PeerError && [401, 426].includes(error.status)) {
          this.notice(error.message);
          this.status('expired');
          this.stop();
        } else this.status('reconnecting');
      }),
    );
    if (this.mesh.view) this.onView(this.mesh.view);
    this.mesh.start();
    this.timer = setInterval(() => this.tick(), 50);
    if (typeof window !== 'undefined') {
      // Reload can take longer than the ordinary heartbeat lease on 3D scenes.
      // Use the existing suspended-member grace period, even after navigation.
      const pagehide = () => {
        if (this.stopped || this.leaving) return;
        void peerRequest(
          {
            ...this.mesh.session,
            instance: this.mesh.instance,
            op: 'suspend',
          },
          true,
        ).catch(() => {});
      };
      window.addEventListener('pagehide', pagehide);
      this.unsubscribe.push(() =>
        window.removeEventListener('pagehide', pagehide),
      );
      let transition = Promise.resolve();
      this.unsubscribe.push(
        bindGameLifecycle((active) => {
          transition = transition
            .catch(() => {})
            .then(async () => {
              if (this.stopped) return;
              this.lastTick = performance.now();
              if (!active && this.authoritative())
                await this.commit().catch(() => {});
              if (!this.stopped)
                await this.mesh.rpc(active ? 'resume' : 'suspend');
            })
            .catch(() => this.status('reconnecting'));
        }),
      );
    }
  }
  private notice(message: string) {
    if (typeof window !== 'undefined')
      window.dispatchEvent(
        new CustomEvent('gamestyle-peer-status', {
          detail: { game: this.game, code: this.session.code, message },
        }),
      );
  }
  private onView(view: PeerView) {
    if (this.stopped) return;
    if (view.epoch !== this.epoch) {
      const previous = this.epoch;
      this.epoch = view.epoch;
      this.engine = undefined;
      this.encoders.clear();
      this.decoder.reset();
      this.recovery = undefined;
      this.restoring = false;
      this.receivedVersion = -1;
      this.receivedAt = 0;
      this.status('reconnecting');
      if (previous) {
        const name =
          view.members.find((m) => m.id === view.host)?.name ??
          'the next player';
        this.notice(
          view.host === this.session.id
            ? 'You are taking over as host…'
            : `Passing host to ${name}…`,
        );
      }
    }
    if (view.checkpoint) this.recovery = view.checkpoint;
    if (view.host === this.session.id && !this.engine && !this.restoring) {
      this.restoring = true;
      void this.restore(view).catch((error) => {
        if (this.epoch !== view.epoch || this.stopped) return;
        this.restoring = false;
        this.status('reconnecting');
        this.notice(
          error instanceof Error ? error.message : 'Recovering the room…',
        );
      });
    }
  }
  private async restore(view: PeerView) {
    const { createEngine } = await this.loadEngine();
    const scope = `${this.game}:${this.session.code}`;
    // Polls omit the checkpoint after the first recovery response. Retain it for retries.
    const checkpoint = view.checkpoint ?? this.recovery;
    const saved = checkpoint
      ? await openCheckpoint<EngineCheckpoint>(
          checkpoint,
          checkpoint.key,
          scope,
        )
      : undefined;
    if (
      this.stopped ||
      this.mesh.view?.host !== this.session.id ||
      this.epoch !== view.epoch
    )
      return;
    if (!saved && !view.open)
      throw new Error(
        'No recovery checkpoint is available. Create a new room to play again.',
      );
    this.engine = createEngine(view.now, saved);
    if (view.party) this.engine.configureParty();
    this.engine.reconcile(this.mesh.view.members, this.mesh.view.npcs);
    this.lastTick = performance.now();
    await this.commit();
    if (
      this.stopped ||
      this.epoch !== view.epoch ||
      this.mesh.view?.host !== this.session.id
    )
      return;
    this.restoring = false;
    if (view.epoch > 1) this.notice('Host handover complete. Keep playing.');
  }
  private authoritative() {
    return (
      !this.stopped &&
      this.mesh.view?.host === this.session.id &&
      this.mesh.view.epoch === this.epoch &&
      performance.now() < this.mesh.validUntil &&
      !!this.engine
    );
  }
  private commit() {
    return this.durability.request();
  }
  private async saveCheckpoint() {
    const epoch = this.epoch;
    const started = performance.now();

    if (!this.authoritative() || this.epoch !== epoch || !this.mesh.view?.key)
      throw new Error('Waiting for the new host…');
    const engine = this.engine!;
    const state = engine.checkpoint();
    const open = engine.open;
    const checkpoint = await sealCheckpoint(
      state,
      this.mesh.view.key,
      `${this.game}:${this.session.code}`,
      epoch,
      state.seq,
    );
    if (!this.authoritative() || this.epoch !== epoch)
      throw new Error('Waiting for the new host…');
    await this.mesh.rpc('checkpoint', {
      epoch,
      checkpoint,
      open,
      rosterRevision: state.rosterRevision,
    });
    this.lastSave = performance.now();
    this.diagnostics.checkpointMs = this.lastSave - started;
  }
  private tick() {
    if (this.stopped || this.leaving) return;
    const now = performance.now(),
      delta = now - this.lastTick;
    this.lastTick = now;
    const view = this.mesh.view;
    if (!view) return;
    const input = this.readInput();
    const order = ++this.order;
    if (this.authoritative() && !this.restoring) {
      try {
        this.engine!.reconcile(view.members, view.npcs);
        this.engine!.input(this.session.id, input, order);
        if (
          view.party &&
          !this.engine!.world.partyRoundStarted &&
          !this.partyStarting &&
          view.members.every((m) => !!m.instance && !m.suspended)
        ) {
          this.partyStarting = true;
          const type = ['sample-stampede', 'zorb-clash'].includes(this.game)
            ? 'ready'
            : 'start';
          void this.action({ type })
            .finally(() => {
              this.partyStarting = false;
            })
            .catch(() => {});
        }
        this.engine!.advance(delta);
        this.diagnostics.simulationMs = performance.now() - now;
        this.diagnostics.snapshotMs = 0;
        this.diagnostics.encodingMs = 0;
        for (const id of this.encoders.keys())
          if (!view.members.some((m) => m.id === id)) this.encoders.delete(id);
        for (const member of view.members) {
          const snapshotAt = performance.now();
          const snapshot = this.engine!.snapshot(
            this.session.code,
            this.session.id,
            member.id,
            this.epoch,
          );
          this.diagnostics.snapshotMs += performance.now() - snapshotAt;
          if (member.id === this.session.id) this.deliver(snapshot);
          else {
            let codec = this.encoders.get(member.id);
            if (!codec) {
              codec = new SnapshotSender();
              this.encoders.set(member.id, codec);
            }
            const encodingAt = performance.now();
            const packet = codec.encode(snapshot, now);
            if (!this.mesh.send(member.id, { ...packet, epoch: this.epoch }))
              codec.reset();
            this.diagnostics.encodingMs += performance.now() - encodingAt;
          }
        }
        if (now - this.lastSave > 1000 && !this.saving) {
          this.saving = true;
          void this.commit()
            .catch(() => this.status('reconnecting'))
            .finally(() => {
              this.saving = false;
            });
        }
      } catch {
        this.status('reconnecting');
      }
    } else {
      this.mesh.send(view.host, {
        type: 'input',
        epoch: this.epoch,
        input,
        order,
      });
      if (now >= this.mesh.validUntil || now - this.receivedAt > 2000)
        this.status('reconnecting');
    }
    this.diagnostics.tickMs = performance.now() - now;
    if (typeof document !== 'undefined' && now - this.diagnosticAt > 1000) {
      this.diagnosticAt = now;
      document.documentElement.dataset.peerPerformance = JSON.stringify({
        game: this.game,
        ...this.diagnostics,
        ...this.mesh.diagnostics,
      });
    }
    for (const [requestId, pending] of this.pending) {
      if (now > pending.until) {
        pending.reject(
          new Error('The host is still reconnecting. Try the action again.'),
        );
        this.pending.delete(requestId);
        continue;
      }
      if (now - pending.sent < 350) continue;
      pending.sent = now;
      if (this.authoritative() && !this.restoring)
        this.handleAction(
          this.session.id,
          requestId,
          pending.action,
          this.epoch,
        );
      else
        this.mesh.send(view.host, {
          type: 'action',
          epoch: this.epoch,
          action: pending.action,
          requestId,
        });
    }
  }
  private deliver(snapshot: GameSnapshot) {
    if (this.stopped || snapshot.version <= this.receivedVersion) return;
    this.receivedVersion = snapshot.version;
    this.receivedAt = performance.now();
    this.receive(snapshot as S);
    this.status('online');
    if (
      this.mesh.view?.party &&
      snapshot.partyRoundStarted &&
      typeof window !== 'undefined'
    )
      window.dispatchEvent(new Event('game:party-ready'));
  }
  private onMessage(id: string, raw: unknown) {
    if (this.stopped || !raw || typeof raw !== 'object') return;
    const message = raw as Packet;
    if (
      message.epoch !== this.epoch ||
      performance.now() >= this.mesh.validUntil
    )
      return;
    if (
      id === this.mesh.view?.host &&
      ['baseline', 'snapshot-delta'].includes(message.type)
    ) {
      const decoded = this.decoder.decode(message as unknown as StatePacket);
      if (decoded && decoded.host === id && decoded.code === this.session.code)
        this.deliver(decoded);
      else if (performance.now() - this.lastResync > 500) {
        this.lastResync = performance.now();
        this.mesh.send(id, { type: 'resync', epoch: this.epoch });
      }
      return;
    }
    if (message.type === 'resync' && this.authoritative()) {
      this.encoders.get(id)?.reset();
      return;
    }
    if (
      message.type === 'snapshot' &&
      id === this.mesh.view?.host &&
      message.snapshot?.host === id &&
      message.snapshot.code === this.session.code &&
      Number.isSafeInteger(message.snapshot.version) &&
      message.snapshot.world &&
      Array.isArray(message.snapshot.world.players)
    )
      this.deliver(message.snapshot);
    else if (
      message.type === 'input' &&
      this.authoritative() &&
      !this.restoring &&
      this.mesh.view!.members.some((m) => m.id === id)
    )
      this.engine!.input(id, message.input, message.order ?? -1);
    else if (
      message.type === 'action' &&
      typeof message.requestId === 'string' &&
      message.requestId.length <= 80 &&
      this.authoritative() &&
      !this.restoring
    )
      this.handleAction(id, message.requestId, message.action, message.epoch);
    else if (
      message.type === 'ack' &&
      id === this.mesh.view?.host &&
      typeof message.requestId === 'string'
    )
      this.ack(message.requestId, message.error);
  }
  private handleAction(
    id: string,
    requestId: string,
    action: unknown,
    epoch: number,
  ) {
    const key = id + ':' + requestId;
    if (this.processing.has(key) || this.processing.size >= 32) return;
    this.processing.add(key);
    this.actionQueue = this.actionQueue
      .catch(() => {})
      .then(async () => {
        if (
          !this.authoritative() ||
          this.epoch !== epoch ||
          !this.mesh.view!.members.some((m) => m.id === id)
        ) {
          this.processing.delete(key);
          return;
        }
        const type =
          action && typeof action === 'object'
            ? (action as { type?: unknown }).type
            : null;
        if (
          (type === 'start' || type === 'restart') &&
          id === this.session.id
        ) {
          await this.mesh.rpc('lock', { epoch });
          if (!this.authoritative() || this.epoch !== epoch) {
            this.processing.delete(key);
            return;
          }
          this.engine!.reconcile(this.mesh.view!.members, this.mesh.view!.npcs);
        }
        const result = this.engine!.execute(
          id,
          requestId,
          action,
          this.session.id,
        );
        if (
          !result.error &&
          this.mesh.view?.party &&
          ['start', 'ready'].includes(String(type))
        )
          this.engine!.world.partyRoundStarted = true;
        // Continue ordered execution now; acknowledge only the checkpoint batch containing this receipt.
        void this.commit()
          .then(() => {
            if (!this.authoritative() || this.epoch !== epoch) return;
            if (id === this.session.id) this.ack(requestId, result.error);
            else
              this.mesh.send(id, { type: 'ack', epoch, requestId, ...result });
          })
          .catch(() => this.status('reconnecting'))
          .finally(() => this.processing.delete(key));
      })
      .catch(() => {
        this.processing.delete(key);
        this.status('reconnecting');
      });
  }
  private ack(id: string, error?: string) {
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    if (error) pending.reject(new Error(error));
    else pending.resolve();
  }
  action(action: unknown): Promise<void> {
    if (this.stopped || this.leaving)
      return Promise.reject(new Error('Rejoin the room before playing.'));
    return new Promise((resolve, reject) => {
      this.pending.set(crypto.randomUUID(), {
        action,
        resolve,
        reject,
        until: performance.now() + 25000,
        sent: 0,
      });
    });
  }
  manageNpcs(action: NpcAction): Promise<void> {
    const requestId = crypto.randomUUID();
    const task = this.actionQueue
      .catch(() => {})
      .then(async () => {
        if (!this.authoritative() || this.restoring || this.leaving)
          throw new Error('Wait for the crew leader to reconnect.');
        const view = await this.mesh.rpc('npc', {
          action,
          requestId,
          epoch: this.epoch,
        });
        if (!this.authoritative())
          throw new Error('The crew has a new leader.');
        this.engine!.reconcile(view.members, view.npcs);
        await this.commit();
      });
    this.actionQueue = task;
    return task;
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.timer);
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    for (const pending of this.pending.values())
      pending.reject(new Error('You left the game.'));
    this.pending.clear();
    this.engine = undefined;
    this.release();
  }
  async leave() {
    if (this.leaving) return;
    this.leaving = true;
    try {
      if (this.authoritative()) await this.commit().catch(() => {});
      await this.mesh.leave();
    } finally {
      this.stop();
    }
  }
}
