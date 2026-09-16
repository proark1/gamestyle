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
        friction: 0.15,
        restitution: 0.05,
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
      const shape = new C.Box(new C.Vec3(0.65, 0.45, 0.55));
      const body = new C.Body({
        mass: cart.totalMass,
        material: this.cartMaterial,
        position: new C.Vec3(cart.x, 0.45, cart.z),
        linearDamping: 0.12,
        angularDamping: 0.35,
      });
      body.addShape(shape);
      body.quaternion.setFromAxisAngle(new C.Vec3(0, 1, 0), cart.rotY);
      this.world.addBody(body);
      this.cartBodies.set(cart.id, body);
    }
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

      // Also support single player controlling both steer & grabber
      const grabberPlayer = this.state.players.find(
        (p) => p.cartId === cart.id && p.role === 'grabber',
      );
      const grabberInput =
        (grabberPlayer && inputs.get(grabberPlayer.id)) || input;

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

      // Squeaky wheel pulls hard to the left periodically!
      const squeakPull = Math.sin(cart.wobblePhase) * 0.18 + 0.12; // Net bias to the left

      // Slip Spin hazard countdown
      if (cart.slipSpinTimer > 0) {
        cart.slipSpinTimer -= dt;
        body.angularVelocity.y = 8.5; // Rapid spin out!
      } else {
        // Steering
        const effectiveSteer = input.steer - squeakPull * cart.wobbleIntensity;
        const turnSpeed = 3.2 - (cart.totalMass / 350) * 1.2; // Heavier carts turn slower
        body.angularVelocity.y = -effectiveSteer * turnSpeed;
      }

      // Acceleration / Throttle
      let thrust = 750 + cart.totalMass * 4; // Scales with mass for authentic momentum
      if (cart.sugarRushTimer > 0) {
        cart.sugarRushTimer -= dt;
        thrust *= 1.8; // Nitrous sugar rush speed boost!
      }

      const forwardDir = body.quaternion.vmult(new C.Vec3(1, 0, 0));
      const rightDir = body.quaternion.vmult(new C.Vec3(0, 0, 1));

      if (cart.slipSpinTimer <= 0) {
        const driveForce = forwardDir.scale(input.throttle * thrust);
        body.applyForce(driveForce, body.position);
      }

      // Lateral Friction & Drifting:
      // Calculate lateral velocity component
      const lateralVel = body.velocity.dot(rightDir);
      let lateralGrip = input.drift ? 0.08 : 0.82; // Handbrake drift reduces lateral grip

      // Heavily loaded carts gain massive drift momentum
      if (cart.totalMass > 100) {
        lateralGrip *= Math.max(0.35, 1 - (cart.totalMass - 100) / 300);
      }

      if (cart.slipSpinTimer > 0) {
        lateralGrip = 0.01; // Zero friction on slip
      }

      const lateralImpulse = rightDir.scale(
        -lateralVel * body.mass * (1 - lateralGrip) * 0.15,
      );
      body.applyImpulse(lateralImpulse, body.position);

      cart.driftSlip = Math.abs(lateralVel);

      // Keep cart upright on floor
      body.position.y = 0.45;
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
      this.handleGrabberAction(cart, grabberInput, dt, events);

      // High-speed collision check: risk of dropping items if rammed hard
      this.checkCartCollisions(cart, events);
    }

    // Step the Cannon-es simulation
    this.world.step(STEP, dt, 3);

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

  private handleGrabberAction(
    cart: ShoppingCart,
    input: PlayerInput,
    dt: number,
    events: StampedeEvent[],
  ) {
    if (cart.grabberCooldown > 0) {
      cart.grabberCooldown -= dt;
    }

    if (input.grabberAction && cart.grabberCooldown <= 0) {
      cart.grabberCooldown = 0.8;
      cart.grabberReach = 1.0;
      cart.grabberSwatting = true;

      // Determine reach position in world space
      const reachDist = 2.4;
      const reachAngle = cart.rotY + (cart.grabberAngle || 0);
      const reachX = cart.x + Math.cos(reachAngle) * reachDist;
      const reachZ = cart.z - Math.sin(reachAngle) * reachDist;

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
      }
    }
  }

  private trySnagItem(
    cart: ShoppingCart,
    reachX: number,
    reachZ: number,
    events: StampedeEvent[],
  ) {
    for (let i = 0; i < this.state.groundItems.length; i++) {
      const item = this.state.groundItems[i];
      const dx = reachX - item.x;
      const dz = reachZ - item.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 1.4) {
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
        break;
      }
    }
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

  private checkCartCollisions(cart: ShoppingCart, events: StampedeEvent[]) {
    const speed = Math.sqrt(cart.vx * cart.vx + cart.vz * cart.vz);
    if (speed > 7.5 && cart.items.length > 0 && Math.random() < 0.08) {
      // Violent crash dumps an item
      const dropped = cart.items.pop();
      if (dropped) {
        this.spawnGroundItem(
          dropped.kind,
          cart.x + (Math.random() - 0.5) * 1.8,
          0.6,
          cart.z + (Math.random() - 0.5) * 1.8,
          false,
        );
        events.push({
          id: Date.now() + Math.random(),
          type: 'cart_crash',
          x: cart.x,
          y: cart.y,
          z: cart.z,
          text: 'CRASH!',
          intensity: 1.0,
        });
      }
    }
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
