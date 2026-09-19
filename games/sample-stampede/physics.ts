import * as C from 'cannon-es';
import {
  ITEM_DEFS,
  type CarriedItem,
  type GroundItem,
  type ItemKind,
  type PlayerInput,
  type SampleStampedeWorld,
  type ShoppingCart,
  type StampedeEvent,
} from './types';

export const STEP = 1 / 60;
const GRAB_COOLDOWN = 0.8;
// The pole reaches this far out, and snags what lies within GRAB_RADIUS of
// its claw.
export const GRAB_REACH = 2.4;
export const GRAB_RADIUS = 1.4;
// A hit against a wall, rack or cart at this closing speed (m/s) is a crash
// that shakes an item out of the basket.
const CRASH_SPEED = 6;
const CRASH_COOLDOWN = 0.6;
export const WAREHOUSE_BOUNDS = {
  minX: -26,
  maxX: 26,
  minZ: -34,
  maxZ: 34,
};

export class SampleStampedePhysics {
  world: C.World;
  groundMaterial: C.Material;
  cartMaterial: C.Material;
  shelfMaterial: C.Material;
  itemMaterial: C.Material;

  cartBodies = new Map<string, C.Body>();
  itemBodies = new Map<string, C.Body>();
  shelfBodies: C.Body[] = [];
  wallBodies: C.Body[] = [];
  // Per cart: whether GRAB was held last step, and how long a fresh press
  // still waits for the pole.
  private grabPresses = new Map<string, { held: boolean; wait: number }>();
  // Per cart: the hardest hit this step, and how long until it can crash again.
  private impacts = new Map<string, number>();
  private crashCooldowns = new Map<string, number>();
  // What a cart can crash into: walls, racks and other carts, not stock.
  private solidBodies = new Set<C.Body>();

  constructor(public state: SampleStampedeWorld) {
    this.world = new C.World({
      gravity: new C.Vec3(0, -16.0, 0), // Snappy arcade gravity
      allowSleep: true,
    });
    this.world.solver = new C.GSSolver();
    (this.world.solver as C.GSSolver).iterations = 12;
    (this.world.solver as C.GSSolver).tolerance = 1e-4;

    this.groundMaterial = new C.Material('concrete');
    this.cartMaterial = new C.Material('cart');
    this.shelfMaterial = new C.Material('shelf');
    this.itemMaterial = new C.Material('item');

    // Concrete vs Cart: slick polished floor with controlled lateral grip
    this.world.addContactMaterial(
      new C.ContactMaterial(this.groundMaterial, this.cartMaterial, {
        friction: 0.0,
        restitution: 0.0,
      }),
    );

    // Cart vs Cart: loud bouncy clatter
    this.world.addContactMaterial(
      new C.ContactMaterial(this.cartMaterial, this.cartMaterial, {
        friction: 0.2,
        restitution: 0.65,
      }),
    );

    // Cart vs Shelf: heavy thud
    this.world.addContactMaterial(
      new C.ContactMaterial(this.cartMaterial, this.shelfMaterial, {
        friction: 0.35,
        restitution: 0.3,
      }),
    );

    // Item vs Ground
    this.world.addContactMaterial(
      new C.ContactMaterial(this.itemMaterial, this.groundMaterial, {
        friction: 0.4,
        restitution: 0.3,
      }),
    );

    this.setupEnvironment();
    this.setupCarts();
    this.setupItems();
  }

  private setupEnvironment() {
    // Floor
    const groundBody = new C.Body({
      type: C.Body.STATIC,
      shape: new C.Plane(),
      material: this.groundMaterial,
    });
    groundBody.quaternion.setFromAxisAngle(new C.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(groundBody);

    // Outer Warehouse Walls
    const wallThick = 1.0;
    const wallH = 6.0;
    const { minX, maxX, minZ, maxZ } = WAREHOUSE_BOUNDS;
    const w = maxX - minX;
    const l = maxZ - minZ;

    const createWall = (x: number, z: number, sx: number, sz: number) => {
      const b = new C.Body({
        type: C.Body.STATIC,
        shape: new C.Box(new C.Vec3(sx / 2, wallH / 2, sz / 2)),
        position: new C.Vec3(x, wallH / 2, z),
        material: this.shelfMaterial,
      });
      this.world.addBody(b);
      this.wallBodies.push(b);
    };

    createWall(0, minZ - wallThick / 2, w, wallThick); // North
    createWall(0, maxZ + wallThick / 2, w, wallThick); // South
    createWall(minX - wallThick / 2, 0, wallThick, l); // West
    createWall(maxX + wallThick / 2, 0, wallThick, l); // East

    // Shelving Units
    for (const shelf of this.state.shelves) {
      const b = new C.Body({
        type: C.Body.STATIC,
        shape: new C.Box(
          new C.Vec3(shelf.width / 2, shelf.height / 2, shelf.length / 2),
        ),
        position: new C.Vec3(shelf.x, shelf.height / 2, shelf.z),
        material: this.shelfMaterial,
      });
      this.world.addBody(b);
      this.shelfBodies.push(b);
    }
  }

  private setupCarts() {
    for (const cart of this.state.carts) {
      const shape = new C.Box(new C.Vec3(0.78, 0.52, 0.62));
      const body = new C.Body({
        mass: cart.totalMass,
        material: this.cartMaterial,
        position: new C.Vec3(cart.x, 0.52, cart.z),
        linearDamping: 0.38,
        angularDamping: 0.55,
      });
      body.addShape(shape);
      body.angularFactor = new C.Vec3(0, 1, 0);
      body.quaternion.setFromAxisAngle(new C.Vec3(0, 1, 0), cart.rotY);
      // cannon-es reports each new contact once, before the solver, so the
      // closing speed is the speed of the hit.
      body.addEventListener(
        'collide',
        (e: { body: C.Body; contact: C.ContactEquation }) => {
          if (!this.solidBodies.has(e.body)) return;
          const speed = Math.abs(e.contact.getImpactVelocityAlongNormal());
          this.impacts.set(
            cart.id,
            Math.max(this.impacts.get(cart.id) ?? 0, speed),
          );
        },
      );
      this.world.addBody(body);
      this.cartBodies.set(cart.id, body);
    }
    for (const b of [
      ...this.wallBodies,
      ...this.shelfBodies,
      ...this.cartBodies.values(),
    ])
      this.solidBodies.add(b);
  }

  private setupItems() {
    for (const item of this.state.groundItems) {
      const def = ITEM_DEFS[item.kind];
      const shape = new C.Box(
        new C.Vec3(def.width / 2, def.height / 2, def.depth / 2),
      );
      const body = new C.Body({
        mass: item.onShelf ? 0 : def.mass, // Static while on shelf, dynamic once knocked off
        type: item.onShelf ? C.Body.STATIC : C.Body.DYNAMIC,
        material: this.itemMaterial,
        position: new C.Vec3(item.x, item.y, item.z),
        linearDamping: 0.2,
        angularDamping: 0.3,
      });
      body.addShape(shape);
      body.quaternion.setFromEuler(item.rotX, item.rotY, item.rotZ);
      this.world.addBody(body);
      this.itemBodies.set(item.id, body);
    }
  }

  /**
   * Primary physics step with Squeaky-Wheel Drifting & Mass-Accumulation
   */
  step(dt: number, inputs: Map<string, PlayerInput>, events: StampedeEvent[]) {
    for (const cart of this.state.carts) {
      const body = this.cartBodies.get(cart.id);
      if (!body) continue;

      // Update mass dynamically based on items currently inside basket
      let carriedMass = 0;
      for (const item of cart.items) {
        carriedMass += ITEM_DEFS[item.kind].mass;
      }
      cart.totalMass = cart.baseMass + carriedMass;
      body.mass = cart.totalMass;
      body.updateMassProperties();

      // Retrieve driver input
      const driverPlayer = this.state.players.find(
        (p) => p.cartId === cart.id && p.role === 'driver',
      );
      const input = (driverPlayer && inputs.get(driverPlayer.id)) || {
        x: 0,
        z: 0,
        steer: 0,
        throttle: 0,
        drift: false,
        grabberAction: false,
      };

      // Squeaky front-left wheel wobble dynamics:
      // Wobble speed scales with cart linear velocity
      const forwardSpeed = body.velocity.dot(
        body.quaternion.vmult(new C.Vec3(1, 0, 0)),
      );
      const isMoving = Math.abs(forwardSpeed) > 0.3;

      if (isMoving) {
        cart.wobblePhase += dt * (14 + Math.abs(forwardSpeed) * 3);
        cart.wobbleIntensity = Math.min(1, Math.abs(forwardSpeed) / 5);
      } else {
        cart.wobbleIntensity = Math.max(0, cart.wobbleIntensity - dt * 3);
      }

      // Squeaky caster wheel shimmy flutter
      const squeakPull =
        Math.sin(cart.wobblePhase) * 0.04 * cart.wobbleIntensity;

      // Slip Spin hazard countdown
      if (cart.slipSpinTimer > 0) {
        cart.slipSpinTimer -= dt;
        body.angularVelocity.y = 8.5; // Rapid spin out!
      } else {
        // Steering: agile and responsive, slightly sharper when drifting
        const effectiveSteer = input.steer + squeakPull;
        const turnSpeed =
          (input.drift ? 4.6 : 3.6) - (cart.totalMass / 350) * 0.8;
        body.angularVelocity.y = effectiveSteer * turnSpeed;
      }

      // Acceleration / Throttle
      let thrust = 620 + cart.totalMass * 5.0; // Responsive punchy thrust
      if (cart.sugarRushTimer > 0) {
        cart.sugarRushTimer -= dt;
        thrust *= 1.85; // Nitrous sugar rush speed boost!
      }

      const forwardDir = body.quaternion.vmult(new C.Vec3(1, 0, 0));
      const rightDir = body.quaternion.vmult(new C.Vec3(0, 0, 1));

      if (cart.slipSpinTimer <= 0) {
        const throttleForce =
          input.throttle >= 0 ? input.throttle : input.throttle * 0.75;
        const driveForce = forwardDir.scale(throttleForce * thrust);
        body.applyForce(driveForce);
      }

      // Lateral Friction & Drifting:
      // Calculate lateral velocity component
      const lateralVel = body.velocity.dot(rightDir);
      let lateralGrip = input.drift ? 0.22 : 0.88; // Handbrake drift breaks lateral grip

      // Heavily loaded carts gain massive drift momentum
      if (cart.totalMass > 100) {
        lateralGrip *= Math.max(0.4, 1 - (cart.totalMass - 100) / 320);
      }

      if (cart.slipSpinTimer > 0) {
        lateralGrip = 0.02; // Zero friction on slip
      }

      const lateralImpulse = rightDir.scale(
        -lateralVel * body.mass * lateralGrip,
      );
      body.applyImpulse(lateralImpulse);

      cart.driftSlip = Math.abs(lateralVel);
    }

    // Step the Cannon-es simulation
    this.world.step(STEP, dt, 3);

    // Post-step: keep upright, sync state, and check collisions
    for (const cart of this.state.carts) {
      const body = this.cartBodies.get(cart.id);
      if (!body) continue;

      // Keep cart upright on floor
      body.position.y = 0.52;
      body.velocity.y = 0;
      const euler = new C.Vec3();
      body.quaternion.toEuler(euler);
      body.quaternion.setFromAxisAngle(new C.Vec3(0, 1, 0), euler.y);

      // Sync state from physics body
      cart.x = body.position.x;
      cart.y = body.position.y;
      cart.z = body.position.z;
      cart.vx = body.velocity.x;
      cart.vy = body.velocity.y;
      cart.vz = body.velocity.z;
      cart.rotY = euler.y;
      cart.angularVelocity = body.angularVelocity.y;

      // Check slip hazard collisions (paper plates / spills)
      this.checkSlipHazards(cart, events);

      // Handle Grabber Pole Action (snag items, swat rivals)
      const grabberPlayer = this.state.players.find(
        (p) => p.cartId === cart.id && p.role === 'grabber',
      );
      const driverPlayer = this.state.players.find(
        (p) => p.cartId === cart.id && p.role === 'driver',
      );
      const input = (driverPlayer && inputs.get(driverPlayer.id)) || {
        x: 0,
        z: 0,
        steer: 0,
        throttle: 0,
        drift: false,
        grabberAction: false,
      };
      // A human in the basket works the pole. Otherwise the driver's GRAB
      // does, next to any bot rider: a solo player's rider is a bot.
      const riderIsHuman = !!grabberPlayer && !grabberPlayer.bot;
      const riderInput = grabberPlayer && inputs.get(grabberPlayer.id);
      this.handleGrabberAction(
        cart,
        riderIsHuman ? riderInput : input,
        riderIsHuman ? undefined : riderInput,
        dt,
        events,
      );

      // A hard hit against a wall, rack or cart shakes an item loose
      this.checkCartCollisions(cart, dt, events);
    }

    // Sync dynamic ground item bodies
    for (const item of this.state.groundItems) {
      const b = this.itemBodies.get(item.id);
      if (!b) continue;

      if (!item.onShelf) {
        item.x = b.position.x;
        item.y = b.position.y;
        item.z = b.position.z;
        item.vx = b.velocity.x;
        item.vy = b.velocity.y;
        item.vz = b.velocity.z;
        const euler = new C.Vec3();
        b.quaternion.toEuler(euler);
        item.rotX = euler.x;
        item.rotY = euler.y;
        item.rotZ = euler.z;

        // Keep item on the floor
        if (item.y < 0.2) {
          item.y = 0.2;
          b.position.y = 0.2;
          b.velocity.y = 0;
        }
      }
    }
  }

  private checkSlipHazards(cart: ShoppingCart, events: StampedeEvent[]) {
    if (cart.slipSpinTimer > 0) return;

    for (let i = this.state.hazards.length - 1; i >= 0; i--) {
      const h = this.state.hazards[i];
      const dx = cart.x - h.x;
      const dz = cart.z - h.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 1.1) {
        // Trigger slip spin!
        cart.slipSpinTimer = 1.35;
        events.push({
          id: Date.now() + Math.random(),
          type: 'plate_slip',
          x: h.x,
          y: 0.1,
          z: h.z,
          text: 'SLIP!',
          team: cart.team,
        });

        // Remove the hazard plate after slipping on it
        this.state.hazards.splice(i, 1);
        break;
      }
    }
  }

  /**
   * `presser`: the crew member whose GRAB presses count (a human rider, or
   * else the driver). `bot`: a bot rider's input, which aims for itself.
   */
  private handleGrabberAction(
    cart: ShoppingCart,
    presser: PlayerInput | undefined,
    bot: PlayerInput | undefined,
    dt: number,
    events: StampedeEvent[],
  ) {
    if (cart.grabberCooldown > 0) {
      cart.grabberCooldown -= dt;
    }

    // A fresh press waits out the cooldown instead of being dropped, so a
    // tap just after the bot rider's swing still swings.
    const pressed = !!presser?.grabberAction;
    const press = this.grabPresses.get(cart.id) ?? { held: false, wait: 0 };
    press.wait =
      pressed && !press.held ? GRAB_COOLDOWN : Math.max(0, press.wait - dt);
    press.held = pressed;
    this.grabPresses.set(cart.id, press);

    const pressing = pressed || press.wait > 0;
    if ((pressing || bot?.grabberAction) && cart.grabberCooldown <= 0) {
      press.wait = 0;
      cart.grabberCooldown = GRAB_COOLDOWN;
      cart.grabberReach = 1.0;
      cart.grabberSwatting = true;
      // The pole swings where its user aims, relative to the cart's heading.
      cart.grabberAngle =
        (pressing ? presser?.grabberAngle : bot?.grabberAngle) ?? 0;

      // Determine reach position in world space
      const reachAngle = cart.rotY + cart.grabberAngle;
      const reachX = cart.x + Math.cos(reachAngle) * GRAB_REACH;
      const reachZ = cart.z - Math.sin(reachAngle) * GRAB_REACH;

      events.push({
        id: Date.now() + Math.random(),
        type: 'grabber_whack',
        x: reachX,
        y: 1.0,
        z: reachZ,
        team: cart.team,
      });

      // 1. Check if reaching near a shelf item or loose ground item to snag it
      this.trySnagItem(cart, reachX, reachZ, events);

      // 2. Check if swatting a rival cart (punch them back or dislodge items)
      this.trySwatRivalCart(cart, reachX, reachZ, events);

      // 3. Check if swatting an unstable shelf rack (cause box tumble collapse!)
      this.tryTumbleShelf(reachX, reachZ, events);
    } else {
      cart.grabberReach = Math.max(0, cart.grabberReach - dt * 2.5);
      if (cart.grabberReach <= 0.1) {
        cart.grabberSwatting = false;
        cart.grabberAngle = 0;
      }
    }
  }

  private trySnagItem(
    cart: ShoppingCart,
    reachX: number,
    reachZ: number,
    events: StampedeEvent[],
  ) {
    // The claw closes on the item nearest to it.
    let i = -1;
    let nearest = GRAB_RADIUS;
    this.state.groundItems.forEach((item, index) => {
      const dist = Math.hypot(reachX - item.x, reachZ - item.z);
      if (dist < nearest) {
        nearest = dist;
        i = index;
      }
    });
    const item = this.state.groundItems[i];
    if (!item) return;

    // Snagged item into basket!
    const carried: CarriedItem = {
      id: item.id,
      kind: item.kind,
      relX: (Math.random() - 0.5) * 0.4,
      relY: 0.15 + cart.items.length * 0.12,
      relZ: (Math.random() - 0.5) * 0.3,
      rotY: Math.random() * Math.PI,
    };
    cart.items.push(carried);

    // Remove from physics world
    const b = this.itemBodies.get(item.id);
    if (b) {
      this.world.removeBody(b);
      this.itemBodies.delete(item.id);
    }
    this.state.groundItems.splice(i, 1);

    // Check if sample item grants sugar rush boost
    if (ITEM_DEFS[item.kind].isSample) {
      cart.sugarRushTimer = 4.5;
      events.push({
        id: Date.now() + Math.random(),
        type: 'sugar_rush',
        x: cart.x,
        y: cart.y,
        z: cart.z,
        text: 'SUGAR RUSH!',
        team: cart.team,
      });
    }

    events.push({
      id: Date.now() + Math.random(),
      type: 'item_snagged',
      x: cart.x,
      y: cart.y + 0.5,
      z: cart.z,
      text: `+ ${ITEM_DEFS[item.kind].name}`,
      team: cart.team,
    });
  }

  private trySwatRivalCart(
    cart: ShoppingCart,
    reachX: number,
    reachZ: number,
    events: StampedeEvent[],
  ) {
    for (const rival of this.state.carts) {
      if (rival.id === cart.id) continue;
      const dx = reachX - rival.x;
      const dz = reachZ - rival.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 1.6) {
        const rBody = this.cartBodies.get(rival.id);
        if (rBody) {
          // Push rival away with swat impulse
          const swatDir = new C.Vec3(dx, 0, dz).unit();
          rBody.applyImpulse(swatDir.scale(550), rBody.position);
        }

        // Sabotage: If we have an unauthorized contraband item (e.g. 10-foot giant teddy),
        // fling it into their cart!
        const teddyIdx = cart.items.findIndex(
          (it) => it.kind === 'giant_teddy',
        );
        if (teddyIdx >= 0) {
          const [teddy] = cart.items.splice(teddyIdx, 1);
          rival.items.push(teddy);
          events.push({
            id: Date.now() + Math.random(),
            type: 'item_lost',
            x: rival.x,
            y: rival.y + 1,
            z: rival.z,
            text: 'TEDDY SABOTAGE!',
            team: rival.team,
          });
        } else if (rival.items.length > 0 && Math.random() < 0.45) {
          // Dislodge one item out of rival's cart!
          const dropped = rival.items.pop();
          if (dropped) {
            this.spawnGroundItem(
              dropped.kind,
              rival.x + (Math.random() - 0.5) * 1.5,
              0.5,
              rival.z + (Math.random() - 0.5) * 1.5,
              false,
            );
            events.push({
              id: Date.now() + Math.random(),
              type: 'item_lost',
              x: rival.x,
              y: rival.y,
              z: rival.z,
              text: 'ITEM LOST!',
              team: rival.team,
            });
          }
        }
        break;
      }
    }
  }

  private tryTumbleShelf(
    reachX: number,
    reachZ: number,
    events: StampedeEvent[],
  ) {
    for (const item of this.state.groundItems) {
      if (!item.onShelf) continue;
      const dx = reachX - item.x;
      const dz = reachZ - item.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 2.0) {
        // Activate shelf item into a falling dynamic body
        const b = this.itemBodies.get(item.id);
        if (b) {
          b.type = C.Body.DYNAMIC;
          b.mass = ITEM_DEFS[item.kind].mass;
          b.updateMassProperties();
          b.velocity.set(
            (Math.random() - 0.5) * 4,
            2.0,
            (Math.random() - 0.5) * 4,
          );
        }
        item.onShelf = false;

        events.push({
          id: Date.now() + Math.random(),
          type: 'shelf_tumble',
          x: item.x,
          y: item.y,
          z: item.z,
          text: 'TIMBERRR!',
        });
      }
    }
  }

  private checkCartCollisions(
    cart: ShoppingCart,
    dt: number,
    events: StampedeEvent[],
  ) {
    const impact = this.impacts.get(cart.id) ?? 0;
    this.impacts.delete(cart.id);
    const cooldown = Math.max(0, (this.crashCooldowns.get(cart.id) ?? 0) - dt);
    this.crashCooldowns.set(cart.id, cooldown);
    if (impact < CRASH_SPEED || cooldown > 0) return;
    this.crashCooldowns.set(cart.id, CRASH_COOLDOWN);

    // Violent crash dumps an item, behind the cart where there is room
    const dropped = cart.items.pop();
    if (dropped) {
      this.spawnGroundItem(
        dropped.kind,
        cart.x - Math.cos(cart.rotY) * 1.5 + (Math.random() - 0.5) * 0.8,
        0.6,
        cart.z + Math.sin(cart.rotY) * 1.5 + (Math.random() - 0.5) * 0.8,
        false,
      );
    }
    events.push({
      id: Date.now() + Math.random(),
      type: 'cart_crash',
      x: cart.x,
      y: cart.y,
      z: cart.z,
      text: 'CRASH!',
      intensity: Math.min(1, impact / (CRASH_SPEED * 2)),
      team: cart.team,
    });
  }

  spawnGroundItem(
    kind: ItemKind,
    x: number,
    y: number,
    z: number,
    onShelf = false,
  ) {
    const id = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const def = ITEM_DEFS[kind];

    const newItem: GroundItem = {
      id,
      kind,
      x,
      y,
      z,
      rotX: 0,
      rotY: Math.random() * Math.PI,
      rotZ: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      onShelf,
    };
    this.state.groundItems.push(newItem);

    const shape = new C.Box(
      new C.Vec3(def.width / 2, def.height / 2, def.depth / 2),
    );
    const body = new C.Body({
      mass: onShelf ? 0 : def.mass,
      type: onShelf ? C.Body.STATIC : C.Body.DYNAMIC,
      material: this.itemMaterial,
      position: new C.Vec3(x, y, z),
      linearDamping: 0.2,
      angularDamping: 0.3,
    });
    body.addShape(shape);
    body.quaternion.setFromAxisAngle(new C.Vec3(0, 1, 0), newItem.rotY);
    this.world.addBody(body);
    this.itemBodies.set(id, body);
  }

  destroy() {
    for (const b of this.cartBodies.values()) this.world.removeBody(b);
    for (const b of this.itemBodies.values()) this.world.removeBody(b);
    for (const b of this.shelfBodies) this.world.removeBody(b);
    for (const b of this.wallBodies) this.world.removeBody(b);
    this.cartBodies.clear();
    this.itemBodies.clear();
    this.shelfBodies = [];
    this.wallBodies = [];
  }
}
