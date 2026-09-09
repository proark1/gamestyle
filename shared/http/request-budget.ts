import { RoomError } from '../rooms/types';
import { readJsonObject } from './json-request';

type Bucket = { tokens: number; at: number; expires: number };

/** Per-process protection with bounded memory; never trusts forwarded IP headers. */
export class RequestBudget {
  private buckets = new Map<string, Bucket>();
  private active = 0;
  constructor(
    private maxConcurrent = 128,
    private maxKeys = 4096,
  ) {}

  enter() {
    if (this.active >= this.maxConcurrent)
      throw new RoomError('The server is busy. Please retry shortly.', 503);
    this.active++;
    let released = false;
    return () => {
      if (!released) this.active--;
      released = true;
    };
  }

  take(key: string, capacity: number, perSecond: number, now = Date.now()) {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) {
        for (const [id, value] of this.buckets)
          if (value.expires <= now) this.buckets.delete(id);
        if (this.buckets.size >= this.maxKeys)
          throw new RoomError('The server is busy. Please retry shortly.', 503);
      }
      bucket = { tokens: capacity, at: now, expires: now };
      this.buckets.set(key, bucket);
    }
    bucket.tokens = Math.min(
      capacity,
      bucket.tokens + (Math.max(0, now - bucket.at) * perSecond) / 1000,
    );
    bucket.at = now;
    bucket.expires = now + (capacity / perSecond) * 1000;
    if (bucket.tokens < 1)
      throw new RoomError('Too many requests. Please retry shortly.', 429);
    bucket.tokens--;
  }
}

const budget = new RequestBudget();

export function budgetError(error: RoomError) {
  return Response.json(
    { error: error.message },
    {
      status: error.status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...([429, 503].includes(error.status) ? { 'Retry-After': '1' } : {}),
      },
    },
  );
}

export function withRequestBudget<Args extends unknown[]>(
  handle: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args) => {
    let release: (() => void) | undefined;
    try {
      release = budget.enter();
      return await handle(request, ...args);
    } catch (error) {
      if (error instanceof RoomError) return budgetError(error);
      throw error;
    } finally {
      release?.();
    }
  };
}

export async function readRoomRequest(request: Request, maxBytes = 4096) {
  const body = await readJsonObject(request, maxBytes);
  const path = new URL(request.url).pathname;
  if (body.op === 'create') {
    // Shared across games so switching endpoints cannot evade room admission.
    budget.take('room-creation', 120, 2);
  } else if (
    typeof body.code === 'string' &&
    /^[A-Z2-9]{6}$/i.test(body.code)
  ) {
    const game =
      path === '/api/peer' &&
      typeof body.game === 'string' &&
      body.game.length <= 40
        ? body.game
        : '';
    const room = `${path}:${game}:${body.code.toUpperCase()}`;
    if (body.op === 'join') budget.take(`join:${room}`, 12, 0.4);
    else {
      budget.take(`room:${room}`, 240, 120);
      if (typeof body.id === 'string' && body.id.length <= 100)
        budget.take(`member:${room}:${body.id}`, 80, 30);
    }
  }
  return body;
}
