import {
  blocked,
  CARTS_SPAWN,
  clearSight,
  DISPLAYS,
  DOOR,
  EQUIPMENT,
  HATCH,
  INTERCOM,
  move,
  OFFICE,
  SWITCH,
  visible,
} from './layout';
import { driveBots } from './bots';
import {
  CART_SPEED,
  distance,
  GUARD_SPEED,
  HIDE_MS,
  HUNT_MS,
  idleInput,
  LADDER_SPEED,
  WALK_SPEED,
  type Action,
  type Figure,
  type Item,
  type Player,
  type Point,
  type Snapshot,
  type World,
} from './types';

function random(w: World) {
  w.seed = (Math.imul(w.seed, 1664525) + 1013904223) >>> 0;
  return w.seed / 4294967296;
}
export const shelfPlayer = (id: string, name: string, now: number): Player => ({
  id,
  name,
  seen: now,
  figureId: null,
  input: idleInput(),
});
export function freshShop(now: number, seed = 91317): World {
  return {
    phase: 'lobby',
    clock: now,
    started: 0,
    huntAt: 0,
    round: 0,
    seed,
    players: [],
    guardId: '',
    guard: { ...OFFICE, angle: Math.PI },
    figures: [],
    items: [],
    projectiles: [],
    projectileSeq: 0,
    carts: [],
    hazards: [],
    intercomUntil: 0,
    intercomCooldown: 0,
    guardWhistleAt: 0,
    guardWhistleEffectUntil: 0,
    guardCoffeeUsed: false,
    shovedDummies: {},
    mistakes: 5,
    inspectAt: 0,
    stunnedUntil: 0,
    powerOff: false,
    keys: 0,
    ladder: false,
    events: [],
    eventSeq: 0,
    message: '',
    routines: {},
    botBrains: {},
    botCounter: 0,
  };
}
function begin(w: World) {
  w.round++;
  w.guardId = w.players[(w.round - 1) % 4].id;
  w.guard = { ...OFFICE, angle: Math.PI };
  w.figures = DISPLAYS.map((p, i) => ({
    ...p,
    id: `display-${w.round}-${i}`,
    angle: random(w) * Math.PI * 2,
    pose: Math.floor(random(w) * 3),
    moving: false,
    carrying: null,
    status: 'active',
    task: 0,
  }));
  const available = [...w.figures];
  for (const p of w.players) {
    p.input = idleInput(p.input.seq);
    p.figureId =
      p.id === w.guardId
        ? null
        : available.splice(Math.floor(random(w) * available.length), 1)[0].id;
  }
  w.items = [
    ...EQUIPMENT.map((item) => ({ ...item, holder: null, delivered: false })),
    ...DISPLAYS.filter((_, i) => i % 2 === 0).map(
      (p, i): Item => ({
        ...p,
        x: p.x + 0.7,
        id: `prop-${i}`,
        kind: 'prop',
        holder: null,
        delivered: false,
      }),
    ),
  ];
  w.carts = CARTS_SPAWN.map((c) => ({ ...c, rider: null, speed: 0 }));
  w.projectiles = [];
  w.hazards = [];
  w.intercomUntil = 0;
  w.intercomCooldown = 0;
  w.guardWhistleAt = 0;
  w.guardWhistleEffectUntil = 0;
  w.guardCoffeeUsed = false;
  w.shovedDummies = {};
  Object.assign(w, {
    phase: 'hiding',
    started: w.clock,
    huntAt: w.clock + HIDE_MS,
    mistakes: 5,
    inspectAt: 0,
    stunnedUntil: 0,
    powerOff: false,
    keys: 0,
    ladder: false,
    message: '',
    routines: {},
    events: [],
    botBrains: {},
  });
}
function addBot(w: World) {
  if (w.players.length >= 4) throw new Error('All four places are taken.');
  const number = (w.botCounter ?? 0) + 1;
  w.botCounter = number;
  const names = ['Oakley', 'Maple', 'Chip', 'Peggy', 'Birch', 'Woody'];
  const name = names[(number - 1) % names.length];
  w.players.push({
    ...shelfPlayer(
      `npc-${number}`,
      w.players.some((p) => p.name === name) ? `${name} ${number}` : name,
      w.clock,
    ),
    bot: true,
  });
}
function sound(
  w: World,
  kind: World['events'][number]['kind'],
  point: Point,
  material: Item['kind'] = 'prop',
) {
  if (
    w.clock < (w.intercomUntil ?? 0) &&
    kind !== 'crash' &&
    kind !== 'whistle' &&
    kind !== 'intercom' &&
    kind !== 'switch'
  ) {
    return;
  }
  w.events.push({
    id: ++w.eventSeq,
    at: w.clock,
    kind,
    material,
    x: point.x,
    z: point.z,
  });
  w.events = w.events.filter((event) => w.clock - event.at < 1600).slice(-20);
}
export function dismount(w: World, figure: Figure) {
  const cart = w.carts?.find((c) => c.rider === figure.id);
  if (cart) {
    cart.rider = null;
    cart.speed = 0;
  }
}
export function drop(w: World, figure: Figure) {
  const item = w.items.find((item) => item.id === figure.carrying);
  if (item) {
    item.holder = null;
    item.x = figure.x;
    item.z = figure.z;
    sound(w, 'drop', figure, item.kind);
  }
  figure.carrying = null;
}
const reachable = (a: Point, b: Point, range = 1.65) =>
  distance(a, b) <= range && clearSight(a, b);
function finish(w: World) {
  if (w.phase !== 'playing') return;
  const crew = w.figures.filter((figure) =>
    w.players.some((player) => player.figureId === figure.id),
  );
  const escaped = crew.some((figure) => figure.status === 'escaped');
  if (w.mistakes <= 0) w.phase = 'mannequins-win';
  else if (
    crew.every((figure) => figure.status !== 'active') ||
    w.clock >= w.huntAt + HUNT_MS
  )
    w.phase = escaped ? 'mannequins-win' : 'guard-win';
  if (w.phase !== 'playing')
    for (const p of w.players) p.input = idleInput(p.input.seq);
}
export function shelfAction(
  w: World,
  id: string,
  action: Action,
  host: string,
) {
  const player = w.players.find((p) => p.id === id);
  if (!player) throw new Error('Rejoin the room to play.');
  if (['add-bot', 'remove-bot', 'fill-start'].includes(action.type)) {
    if (id !== host || player.bot)
      throw new Error('Only the room host can manage NPCs.');
    if (w.phase === 'hiding' || w.phase === 'playing')
      throw new Error('Manage NPCs between shifts.');
    if (action.type === 'remove-bot') {
      if (!w.players.some((p) => p.id === action.target && p.bot))
        throw new Error('Choose an NPC to remove.');
      removeShelfPlayer(w, action.target!);
      return;
    }
    if (action.type === 'add-bot') {
      addBot(w);
      return;
    }
    while (w.players.length < 4) addBot(w);
    begin(w);
    return;
  }
  if (action.type === 'start' || action.type === 'restart') {
    if (host !== id) throw new Error('Only the room host can start a shift.');
    if (w.phase === 'hiding' || w.phase === 'playing')
      throw new Error('Finish this shift first.');
    if (w.players.length !== 4)
      throw new Error(
        'Shelf Control needs exactly four players. Invite friends or add NPCs.',
      );
    begin(w);
    return;
  }
  if (w.phase !== 'hiding' && w.phase !== 'playing')
    throw new Error('Wait for the next shift.');
  if (id === w.guardId) {
    if (w.phase === 'hiding')
      throw new Error('Stay in the office until the hiding countdown ends.');
    if (action.type === 'whistle') {
      if (w.clock < (w.guardWhistleAt ?? 0))
        throw new Error('Whistle is on cooldown.');
      w.guardWhistleAt = w.clock + 18000;
      w.guardWhistleEffectUntil = w.clock + 700;
      sound(w, 'whistle', w.guard, 'prop');
      return;
    }
    if (action.type === 'spill-coffee') {
      if (w.guardCoffeeUsed)
        throw new Error('Coffee already spilled this round.');
      w.guardCoffeeUsed = true;
      w.hazards = w.hazards ?? [];
      w.hazards.push({
        id: `coffee-${w.round}`,
        kind: 'coffee',
        x: w.guard.x,
        z: w.guard.z,
      });
      sound(w, 'drop', w.guard, 'prop');
      return;
    }
    if (action.type !== 'inspect' && action.type !== 'interact')
      throw new Error('Inspect a nearby suspicious mannequin.');
    if (w.clock < w.inspectAt)
      throw new Error('Give it a moment before inspecting again.');
    const candidates = w.figures.filter(
      (f) =>
        f.status === 'active' &&
        visible(w.guard, f, true) &&
        reachable(w.guard, f, 1.9),
    );
    const figure = action.target
      ? candidates.find((f) => f.id === action.target)
      : candidates.sort(
          (a, b) => distance(a, w.guard) - distance(b, w.guard),
        )[0];
    if (!figure) throw new Error('Face a nearby mannequin with a clear view.');
    w.inspectAt = w.clock + 2000;
    if (w.players.some((p) => p.figureId === figure.id)) {
      drop(w, figure);
      dismount(w, figure);
      figure.status = 'caught';
      figure.task = 0;
      sound(w, 'catch', figure);
    } else {
      w.mistakes--;
      w.stunnedUntil = w.clock + 1800;
      sound(w, 'inspect', figure);
    }
    finish(w);
    return;
  }
  const figure = w.figures.find((f) => f.id === player.figureId);
  if (!figure || figure.status !== 'active')
    throw new Error('You are waiting for the next shift.');
  if (action.type === 'pose') {
    dismount(w, figure);
    figure.pose = (figure.pose + 1) % 3;
    figure.task = 0;
    player.input = idleInput(player.input.seq);
    return;
  }
  if (action.type === 'drop') {
    drop(w, figure);
    figure.task = 0;
    return;
  }
  if (action.type === 'throw') {
    if (w.phase === 'hiding')
      throw new Error('Wait for the hunt to begin before throwing items.');
    const held = w.items.find((i) => i.id === figure.carrying);
    if (!held) throw new Error('Carry an item first to throw it.');
    held.holder = null;
    figure.carrying = null;
    held.x = figure.x;
    held.z = figure.z;
    w.projectiles = w.projectiles ?? [];
    w.projectiles.push({
      id: ++w.projectileSeq,
      x: figure.x,
      z: figure.z,
      vx: Math.sin(figure.angle) * 8.5,
      vz: Math.cos(figure.angle) * 8.5,
      kind: held.kind,
      at: w.clock,
    });
    sound(w, 'throw', figure, held.kind);
    return;
  }
  if (action.type === 'shove') {
    if (w.phase === 'hiding') throw new Error('Hide first.');
    const dummy = w.figures.find(
      (f) =>
        f.id !== figure.id &&
        !w.players.some((p) => p.figureId === f.id) &&
        f.status === 'active' &&
        reachable(figure, f, 2.0),
    );
    if (!dummy) throw new Error('Stand near a display mannequin to shove it.');
    w.shovedDummies = w.shovedDummies ?? {};
    w.shovedDummies[dummy.id] = {
      until: w.clock + 2200,
      dx: Math.sin(figure.angle),
      dz: Math.cos(figure.angle),
    };
    dummy.moving = true;
    sound(w, 'throw', dummy, 'prop');
    return;
  }
  if (action.type === 'mount-cart') {
    const currentCart = w.carts?.find((c) => c.rider === figure.id);
    if (currentCart) {
      dismount(w, figure);
      return;
    }
    const cart = w.carts?.find((c) => !c.rider && reachable(figure, c, 1.8));
    if (!cart) throw new Error('No rolling cart nearby.');
    cart.rider = figure.id;
    cart.speed = 0;
    return;
  }
  if (action.type === 'dismount-cart') {
    dismount(w, figure);
    return;
  }
  if (action.type === 'intercom') {
    if (w.phase === 'hiding') throw new Error('Wait for the shift to start.');
    if (!reachable(figure, INTERCOM, 2.0))
      throw new Error('Move closer to the service desk intercom.');
    if (w.clock < (w.intercomCooldown ?? 0))
      throw new Error('The intercom announcement is on cooldown.');
    w.intercomUntil = w.clock + 6000;
    w.intercomCooldown = w.clock + 22000;
    sound(w, 'intercom', INTERCOM, 'prop');
    return;
  }
  if (action.type !== 'interact')
    throw new Error('Only the guard can inspect mannequins.');
  if (w.phase === 'hiding')
    throw new Error(
      'Choose a hiding spot now. Start your escape when the hunt begins.',
    );
  if (w.carts?.some((c) => c.rider === figure.id)) {
    dismount(w, figure);
    return;
  }
  if (!figure.carrying && reachable(figure, INTERCOM, 1.8)) {
    if (w.clock >= (w.intercomCooldown ?? 0)) {
      w.intercomUntil = w.clock + 6000;
      w.intercomCooldown = w.clock + 22000;
      sound(w, 'intercom', INTERCOM, 'prop');
      return;
    }
  }
  const nearbyCart =
    !figure.carrying &&
    w.carts?.find((c) => !c.rider && reachable(figure, c, 1.8));
  if (nearbyCart) {
    nearbyCart.rider = figure.id;
    nearbyCart.speed = 0;
    return;
  }
  const held = w.items.find((i) => i.id === figure.carrying);
  if (!w.powerOff && reachable(figure, SWITCH)) {
    figure.task = figure.task ? 0 : 0.001;
    player.input = idleInput(player.input.seq);
    return;
  }
  if (held?.kind === 'key' && reachable(figure, DOOR)) {
    held.delivered = true;
    held.holder = null;
    figure.carrying = null;
    w.keys++;
    sound(w, 'lock', DOOR, 'key');
    return;
  }
  if (held?.kind === 'ladder' && reachable(figure, HATCH)) {
    held.delivered = true;
    held.holder = null;
    figure.carrying = null;
    w.ladder = true;
    sound(w, 'drop', HATCH, 'ladder');
    return;
  }
  if (reachable(figure, DOOR) || reachable(figure, HATCH)) {
    if (!w.powerOff)
      throw new Error('Switch off security in the lighting aisle first.');
    if (reachable(figure, DOOR) ? w.keys < 2 : !w.ladder)
      throw new Error(
        'The loading door needs both keys. The service hatch needs the ladder.',
      );
    drop(w, figure);
    dismount(w, figure);
    figure.status = 'escaped';
    figure.task = 0;
    sound(w, 'escape', figure);
    finish(w);
    return;
  }
  if (held) throw new Error('Carry one thing at a time. Q drops it.');
  const item = w.items
    .filter(
      (i) =>
        !i.delivered &&
        !i.holder &&
        reachable(figure, i) &&
        (!action.target || i.id === action.target),
    )
    .sort((a, b) => distance(a, figure) - distance(b, figure))[0];
  if (!item) {
    const nearbyDummy = w.figures.find(
      (f) =>
        f.id !== figure.id &&
        !w.players.some((p) => p.figureId === f.id) &&
        f.status === 'active' &&
        reachable(figure, f, 1.8),
    );
    if (nearbyDummy) {
      w.shovedDummies = w.shovedDummies ?? {};
      w.shovedDummies[nearbyDummy.id] = {
        until: w.clock + 2200,
        dx: Math.sin(figure.angle),
        dz: Math.cos(figure.angle),
      };
      nearbyDummy.moving = true;
      sound(w, 'throw', nearbyDummy, 'prop');
      return;
    }
    throw new Error('Move closer to a key, prop, ladder, switch or exit.');
  }
  item.holder = figure.id;
  figure.carrying = item.id;
  figure.task = 0;
  sound(w, 'lift', figure, item.kind);
}
function npc(w: World, figure: Figure, dt: number) {
  let routine = w.routines[figure.id];
  if (!routine || w.clock >= routine.until) {
    const walking = random(w) < 0.55;
    const options = DISPLAYS.filter(
      (p) =>
        distance(p, figure) > 1 &&
        distance(p, figure) < 9 &&
        clearSight(figure, p, 0.45),
    );
    routine = {
      walking: walking && !!options.length,
      target: options[Math.floor(random(w) * options.length)] ?? {
        x: figure.x,
        z: figure.z,
      },
      until: w.clock + 3000 + random(w) * 9000,
    };
    w.routines[figure.id] = routine;
    figure.pose = Math.floor(random(w) * 3);
    if (!routine.walking) {
      if (figure.carrying) drop(w, figure);
      else {
        const prop = w.items.find(
          (i) => i.kind === 'prop' && !i.holder && reachable(figure, i, 2),
        );
        if (prop && random(w) < 0.65) {
          prop.holder = figure.id;
          figure.carrying = prop.id;
          sound(w, 'lift', figure);
        }
      }
    }
  }
  const dx = routine.target.x - figure.x,
    dz = routine.target.z - figure.z,
    length = Math.hypot(dx, dz);
  figure.moving =
    routine.walking &&
    length > 0.3 &&
    move(
      figure,
      { x: dx / Math.max(0.01, length), z: dz / Math.max(0.01, length) },
      3.1,
      dt,
    );
  if (length < 0.3) routine.walking = false;
}
export function advanceShop(w: World, now: number) {
  if (now <= w.clock) return;
  if (w.phase !== 'playing' && w.phase !== 'hiding') {
    w.clock = now;
    return;
  }
  const elapsed = Math.min(0.35, (now - w.clock) / 1000),
    steps = Math.max(1, Math.ceil(elapsed / 0.035)),
    dt = elapsed / steps;
  for (let i = 0; i < steps; i++) {
    w.clock = now - (steps - i - 1) * dt * 1000;
    if (w.phase === 'hiding' && w.clock >= w.huntAt) w.phase = 'playing';
    driveBots(
      w,
      (id) => shelfSnapshot(w, '', '', id, 0),
      (id, action) => shelfAction(w, id, action, ''),
    );
    if (w.phase !== 'playing' && w.phase !== 'hiding') break;
    if (w.shovedDummies) {
      for (const [dummyId, shove] of Object.entries(w.shovedDummies)) {
        if (w.clock >= shove.until) {
          delete w.shovedDummies[dummyId];
          const f = w.figures.find((fig) => fig.id === dummyId);
          if (f) f.moving = false;
          continue;
        }
        const f = w.figures.find((fig) => fig.id === dummyId);
        if (f && f.status === 'active') {
          f.moving = move(f, { x: shove.dx, z: shove.dz }, 2.8, dt);
        }
      }
    }
    if (w.projectiles?.length) {
      for (let pIdx = w.projectiles.length - 1; pIdx >= 0; pIdx--) {
        const p = w.projectiles[pIdx];
        const nextX = p.x + p.vx * dt;
        const nextZ = p.z + p.vz * dt;
        if (blocked({ x: nextX, z: nextZ }, 0.25)) {
          const item = w.items.find(
            (i) => !i.holder && !i.delivered && i.kind === p.kind,
          );
          if (item) {
            item.x = p.x;
            item.z = p.z;
          }
          sound(w, 'crash', p, p.kind);
          w.projectiles.splice(pIdx, 1);
          continue;
        }
        p.x = nextX;
        p.z = nextZ;
        if (w.phase === 'playing' && distance(p, w.guard) < 1.1) {
          w.stunnedUntil = Math.max(w.stunnedUntil, w.clock + 1600);
          const item = w.items.find(
            (i) => !i.holder && !i.delivered && i.kind === p.kind,
          );
          if (item) {
            item.x = p.x;
            item.z = p.z;
          }
          sound(w, 'crash', w.guard, p.kind);
          w.projectiles.splice(pIdx, 1);
          continue;
        }
        if (w.clock - p.at > 1200) {
          const item = w.items.find(
            (i) => !i.holder && !i.delivered && i.kind === p.kind,
          );
          if (item) {
            item.x = p.x;
            item.z = p.z;
          }
          sound(w, 'drop', p, p.kind);
          w.projectiles.splice(pIdx, 1);
          continue;
        }
      }
    }
    for (const figure of w.figures) {
      if (figure.status !== 'active') {
        figure.moving = false;
        continue;
      }
      const player = w.players.find((p) => p.figureId === figure.id);
      if (!player) {
        npc(w, figure, dt);
        continue;
      }
      const ridingCart = w.carts?.find((c) => c.rider === figure.id);
      if (ridingCart) {
        const input = w.clock - player.seen < 750 ? player.input : idleInput();
        const inputLen = Math.hypot(input.x, input.z);
        if (inputLen > 0.1) {
          const targetAngle = Math.atan2(input.x, input.z);
          let diff = targetAngle - ridingCart.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          ridingCart.angle += diff * Math.min(1, dt * 5.5);
          ridingCart.speed = Math.min(CART_SPEED, ridingCart.speed + dt * 8);
        } else {
          ridingCart.speed = Math.max(0, ridingCart.speed - dt * 6);
        }
        if (ridingCart.speed > 0.1) {
          const dirX = Math.sin(ridingCart.angle);
          const dirZ = Math.cos(ridingCart.angle);
          const nextX = ridingCart.x + dirX * ridingCart.speed * dt;
          const nextZ = ridingCart.z + dirZ * ridingCart.speed * dt;
          if (blocked({ x: nextX, z: nextZ }, 0.45)) {
            sound(w, 'crash', ridingCart, 'prop');
            ridingCart.speed = 0;
            ridingCart.rider = null;
            figure.task = 0;
            figure.moving = false;
          } else {
            ridingCart.x = nextX;
            ridingCart.z = nextZ;
            figure.x = ridingCart.x;
            figure.z = ridingCart.z;
            figure.angle = ridingCart.angle;
            figure.moving = true;
          }
        } else {
          figure.moving = false;
        }
      } else {
        const input = w.clock - player.seen < 750 ? player.input : idleInput();
        figure.moving = move(
          figure,
          input,
          figure.carrying === 'ladder' ? LADDER_SPEED : WALK_SPEED,
          dt,
        );
      }
      if (w.hazards?.length && figure.moving) {
        for (const h of w.hazards) {
          if (distance(figure, h) < 0.8) {
            move(
              figure,
              { x: Math.sin(figure.angle), z: Math.cos(figure.angle) },
              4.5,
              dt,
            );
            sound(w, 'slip', figure, 'prop');
          }
        }
      }
      if (figure.task) {
        if (
          figure.moving ||
          !reachable(figure, SWITCH) ||
          w.phase !== 'playing' ||
          w.powerOff
        )
          figure.task = 0;
        else {
          figure.task += dt / 3.5;
          if (figure.task >= 1) {
            w.powerOff = true;
            figure.task = 0;
            sound(w, 'switch', SWITCH);
          }
        }
      }
    }
    const guard = w.players.find((p) => p.id === w.guardId);
    if (w.phase === 'playing' && guard && w.clock >= w.stunnedUntil)
      move(
        w.guard,
        w.clock - guard.seen < 750 ? guard.input : idleInput(),
        GUARD_SPEED,
        dt,
      );
  }
  w.clock = now;
  finish(w);
}
export function removeShelfPlayer(w: World, id: string) {
  w.players = w.players.filter((p) => p.id !== id);
  if (w.botBrains) delete w.botBrains[id];
  if (!w.players.some((p) => !p.bot)) {
    w.players = [];
    w.botBrains = {};
  }
  if (w.phase === 'hiding' || w.phase === 'playing') {
    w.phase = 'lobby';
    w.message =
      'Someone left the shift. Invite a friend or add an NPC to start again.';
  }
  for (const p of w.players) {
    p.figureId = null;
    p.input = idleInput(p.input.seq);
  }
}
export function shelfSnapshot(
  w: World,
  code: string,
  host: string,
  id: string,
  version: number,
): Snapshot {
  const player = w.players.find((p) => p.id === id),
    figure = w.figures.find((f) => f.id === player?.figureId);
  const active = w.phase === 'hiding' || w.phase === 'playing';
  const guard = id === w.guardId,
    own = guard ? w.guard : figure;
  const canSee =
    active &&
    !!own &&
    (guard ? w.phase === 'playing' : figure?.status === 'active');
  const sees = (point: Point) => !!canSee && visible(own!, point, guard);
  const figures = w.figures.filter(
    (f) =>
      f.status === 'active' && (sees(f) || (canSee && f.id === figure?.id)),
  );
  const items = w.items
    .filter(
      (item) =>
        !item.delivered &&
        (item.holder ? figures.some((f) => f.id === item.holder) : sees(item)),
    )
    .map((item) => {
      const holder = w.figures.find((f) => f.id === item.holder);
      return { ...item, ...(holder ? { x: holder.x, z: holder.z } : {}) };
    });
  const projectiles = (w.projectiles ?? []).filter((p) => sees(p));
  const carts = (w.carts ?? []).filter((c) => sees(c));
  const hazards = (w.hazards ?? []).filter((h) => sees(h));
  const ridingCart = w.carts?.find((c) => c.rider === figure?.id);
  const flinching =
    !guard &&
    active &&
    figure?.status === 'active' &&
    w.clock < (w.guardWhistleEffectUntil ?? 0);
  const crew = w.figures.filter((f) =>
    w.players.some((p) => p.figureId === f.id),
  );
  return {
    code,
    host,
    version,
    phase: w.phase,
    round: w.round,
    clock: w.clock,
    remaining:
      w.phase === 'hiding'
        ? Math.max(0, w.huntAt - w.clock)
        : Math.max(0, w.huntAt + HUNT_MS - w.clock),
    players: w.players.map((p) => ({
      id: p.id,
      name: p.name,
      ...(p.bot ? { bot: true as const } : {}),
    })),
    you: {
      id,
      role: !active ? 'waiting' : guard ? 'guard' : 'mannequin',
      figureId: !guard && active ? (player?.figureId ?? null) : null,
      status: figure?.status ?? 'active',
      body: active && own ? { x: own.x, z: own.z, angle: own.angle } : null,
      pose: figure?.pose ?? 0,
      carrying: w.items.find((i) => i.id === figure?.carrying)?.kind ?? null,
      task: figure?.task ?? 0,
      input: player ? { ...player.input } : idleInput(),
      stunnedFor: guard ? Math.max(0, w.stunnedUntil - w.clock) : 0,
      ridingCartId: ridingCart?.id ?? null,
      flinching,
    },
    guard: canSee && (guard || sees(w.guard)) ? { ...w.guard } : null,
    figures: figures.map((f) => ({ ...f })),
    items,
    projectiles,
    carts,
    hazards,
    events: w.events.filter((e) => w.clock - e.at < 500 && sees(e)),
    mistakes: w.mistakes,
    escaped: crew.filter((f) => f.status === 'escaped').length,
    caught: crew.filter((f) => f.status === 'caught').length,
    message: w.message,
    objectives:
      guard && active
        ? null
        : { powerOff: w.powerOff, keys: w.keys, ladder: w.ladder },
    inspectCooldown: guard ? Math.max(0, w.inspectAt - w.clock) : 0,
    guardWhistleCooldown: guard
      ? Math.max(0, (w.guardWhistleAt ?? 0) - w.clock)
      : 0,
    guardCoffeeReady: guard ? !w.guardCoffeeUsed : false,
    intercomActive: w.clock < (w.intercomUntil ?? 0),
    emergencyLighting: !guard ? w.powerOff : w.powerOff && sees(SWITCH),
  };
}
