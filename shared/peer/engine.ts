import type { GameId } from '../audio/types';
import type { Member } from './types';
import type { NpcRoster } from '../rooms/npc-slots';

export type PeerInput = {
  x: number;
  z: number;
  jump?: boolean;
  graze?: boolean;
};
export type PeerPlayer = {
  id: string;
  seen: number;
  input: PeerInput;
  lastJump?: number;
};
export type PeerWorld = {
  players: PeerPlayer[];
  clock: number;
  started: number;
  phase: string;
};
export type GameSnapshot = {
  code: string;
  host: string;
  version: number;
  world: { players: { id: string }[] };
};
export type ActionResult = { error?: string };
export type EngineCheckpoint<W extends PeerWorld = PeerWorld> = {
  game: GameId;
  world: W;
  seq: number;
  actions: [string, ActionResult][];
  orders: Record<string, number>;
  instances: Record<string, string>;
  rosterRevision?: number;
};

/** Game rules are injected; the transport never imports another game's simulation. */
export interface GameAdapter<W extends PeerWorld, S extends GameSnapshot> {
  game: GameId;
  /** Optional game-owned entities; they are never network members. */
  autonomous?(player: W['players'][number]): boolean;
  roster?(world: W, roster: NpcRoster): void;
  actions: readonly string[];
  create(now: number): W;
  remove(world: W, id: string, members: Member[]): void;
  add(world: W, member: Member): void;
  input(
    world: W,
    id: string,
    raw: Record<string, unknown>,
    order: number,
  ): void;
  idle(player: W['players'][number]): void;
  advance(world: W, now: number): void;
  act(
    world: W,
    id: string,
    action: Record<string, unknown>,
    host: string,
  ): void;
  snapshot(
    world: W,
    code: string,
    host: string,
    id: string,
    version: number,
  ): S;
}

export interface PeerRuntime {
  world: PeerWorld;
  seq: number;
  readonly open: boolean;
  reconcile(members: Member[], roster?: NpcRoster): void;
  input(id: string, raw: unknown, order: number): void;
  advance(delta: number): void;
  execute(
    id: string,
    requestId: string,
    raw: unknown,
    host: string,
  ): ActionResult;
  checkpoint(): EngineCheckpoint;
  snapshot(code: string, host: string, id: string, epoch: number): GameSnapshot;
}
export type EngineFactory = (
  now: number,
  checkpoint?: EngineCheckpoint,
) => PeerRuntime;
export type EngineLoader = () => Promise<{ createEngine: EngineFactory }>;

export class PeerEngine<
  W extends PeerWorld,
  S extends GameSnapshot,
> implements PeerRuntime {
  world: W;
  seq = 0;
  actions = new Map<string, ActionResult>();
  orders: Record<string, number> = {};
  instances: Record<string, string> = {};
  rosterRevision = 0;

  constructor(
    private adapter: GameAdapter<W, S>,
    now: number,
    checkpoint?: EngineCheckpoint,
  ) {
    if (checkpoint) {
      if (
        checkpoint.game !== adapter.game ||
        !checkpoint.world ||
        !Array.isArray(checkpoint.world.players) ||
        !Number.isFinite(checkpoint.world.clock) ||
        !Number.isSafeInteger(checkpoint.seq)
      )
        throw new Error('The recovery checkpoint could not be read.');
      // A game identifier selects the same adapter that produced this checkpoint.
      this.world = structuredClone(checkpoint.world) as W;
      this.seq = checkpoint.seq;
      this.actions = new Map(checkpoint.actions);
      this.orders = { ...checkpoint.orders };
      this.instances = { ...checkpoint.instances };
      this.rosterRevision = checkpoint.rosterRevision ?? 0;
    } else this.world = adapter.create(now);
    for (const player of this.world.players)
      player.input = {
        ...player.input,
        x: 0,
        z: 0,
        ...('jump' in player.input ? { jump: false } : {}),
        ...('graze' in player.input ? { graze: false } : {}),
      };
  }

  get open() {
    return !['playing', 'escape'].includes(this.world.phase);
  }

  reconcile(members: Member[], roster?: NpcRoster) {
    const alive = new Set(members.map((member) => member.id));
    for (const player of this.world.players)
      if (!alive.has(player.id) && !this.adapter.autonomous?.(player)) {
        this.adapter.remove(this.world, player.id, members);
        delete this.orders[player.id];
        delete this.instances[player.id];
      }
    // Release departed humans before assigning their seats to NPCs.
    if (
      roster &&
      this.adapter.roster &&
      roster.revision >= this.rosterRevision
    ) {
      this.adapter.roster(this.world, roster);
      this.rosterRevision = roster.revision;
    }
    for (const member of members) {
      if (!this.world.players.some((player) => player.id === member.id))
        this.adapter.add(this.world, member);
      if (this.instances[member.id] !== member.instance) {
        this.orders[member.id] = -1;
        this.instances[member.id] = member.instance;
        const player = this.world.players.find(
          (player) => player.id === member.id,
        );
        if (player && 'lastJump' in player) player.lastJump = -1;
      }
    }
    const order = new Map(members.map((member) => [member.id, member.order]));
    this.world.players.sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );
  }

  input(id: string, raw: unknown, order: number) {
    if (
      !Number.isSafeInteger(order) ||
      order <= (this.orders[id] ?? -1) ||
      !raw ||
      typeof raw !== 'object'
    )
      return;
    const value = raw as Record<string, unknown>;
    if (
      ![value.x, value.z].every(
        (number) => typeof number === 'number' && Number.isFinite(number),
      )
    )
      return;
    const player = this.world.players.find((player) => player.id === id);
    if (!player || this.adapter.autonomous?.(player)) return;
    this.adapter.input(
      this.world,
      id,
      {
        ...value,
        x: Math.max(-1, Math.min(1, Number(value.x))),
        z: Math.max(-1, Math.min(1, Number(value.z))),
        seq:
          Number.isSafeInteger(value.seq) && Number(value.seq) >= 0
            ? Number(value.seq)
            : 0,
      },
      order,
    );
    player.seen = this.world.clock;
    this.orders[id] = order;
  }

  advance(delta: number) {
    const now = this.world.clock + Math.max(0, Math.min(100, delta));
    for (const player of this.world.players)
      if (!this.adapter.autonomous?.(player) && now - player.seen > 500)
        this.adapter.idle(player);
    this.adapter.advance(this.world, now);
    this.seq++;
  }

  execute(
    id: string,
    requestId: string,
    raw: unknown,
    host: string,
  ): ActionResult {
    const key = `${id}:${requestId}`;
    const previous = this.actions.get(key);
    if (previous) return previous;
    let result: ActionResult = {};
    try {
      if (
        !this.world.players.some(
          (player) => player.id === id && !this.adapter.autonomous?.(player),
        ) ||
        !/^[a-zA-Z0-9-]{1,80}$/.test(requestId) ||
        !raw ||
        typeof raw !== 'object'
      )
        throw new Error('Invalid game action.');
      const action = raw as Record<string, unknown>;
      if (
        !this.adapter.actions.includes(String(action.type)) ||
        (action.target !== undefined &&
          (typeof action.target !== 'string' || action.target.length > 100))
      )
        throw new Error('Invalid game action.');
      for (const field of ['x', 'y', 'z', 'rotation', 'revision'])
        if (
          action[field] !== undefined &&
          (typeof action[field] !== 'number' || !Number.isFinite(action[field]))
        )
          throw new Error('Invalid game action.');
      this.adapter.act(this.world, id, action, host);
    } catch (error) {
      result = {
        error:
          error instanceof Error ? error.message : 'That action did not work.',
      };
    }
    this.actions.set(key, result);
    while (this.actions.size > 256)
      this.actions.delete(this.actions.keys().next().value!);
    this.seq++;
    return result;
  }

  checkpoint(): EngineCheckpoint<W> {
    return structuredClone({
      game: this.adapter.game,
      world: this.world,
      seq: this.seq,
      actions: [...this.actions],
      orders: this.orders,
      instances: this.instances,
      ...(this.adapter.roster ? { rosterRevision: this.rosterRevision } : {}),
    });
  }

  snapshot(code: string, host: string, id: string, epoch: number): S {
    return structuredClone(
      this.adapter.snapshot(
        this.world,
        code,
        host,
        id,
        epoch * 1_000_000_000 + this.seq,
      ),
    );
  }
}
