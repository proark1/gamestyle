import * as C from 'cannon-es';
import {
  BALL_RADIUS,
  GOAL_DEPTH,
  GOAL_HEIGHT,
  GOAL_WIDTH,
  PITCH_LENGTH,
  PITCH_WIDTH,
  ZORB_RADIUS,
  type Ramp,
  type SpringCushion,
  type TeamId,
  type ZorbClashWorld,
  type ZorbPlayer,
} from './types';

export const STEP = 1 / 60;
export const PLAYER_MASS = 70;
export const BRACED_MASS = PLAYER_MASS;
export const BALL_MASS = 3.5;
export const ROLL_FORCE = 620;
export const MAX_CHARGE_TIME = 1.2;
export const DASH_BURST_TIME = 0.35;
export const TURTLE_DURATION = 3.5; // seconds before auto-righting
export const FENCE_HEIGHT = 8;
export const POST_RADIUS = 0.16;

const vec = (x = 0, y = 0, z = 0) => new C.Vec3(x, y, z);

export type ImpactEvent = {
  type: 'zorb_zorb' | 'zorb_ball' | 'cushion' | 'goalpost';
  x: number;
  y: number;
  z: number;
  intensity: number;
  playerA?: string;
  playerB?: string;
};

export class ZorbClashPhysics {
  world: C.World;

  // Materials
  groundMat: C.Material;
  zorbMat: C.Material;
  ballMat: C.Material;
  cushionMat: C.Material;
  postMat: C.Material;

  playerBodies = new Map<string, C.Body>();
  ballBody: C.Body;
  cushionBodies: C.Body[] = [];
  rampBodies: C.Body[] = [];
  goalSensorRed: C.Body;
  goalSensorBlue: C.Body;

  impacts: ImpactEvent[] = [];
  private accumulator = 0;
  private contactPairs = new Set<string>();
  private goalEntry = 0;
  private pendingGoal: { scored: true; team: TeamId } | null = null;

  constructor(public state: ZorbClashWorld) {
    this.world = new C.World({
      gravity: vec(0, -9.81, 0),
      allowSleep: false,
    });
    this.world.solver = new C.GSSolver();
    (this.world.solver as C.GSSolver).iterations = 15;
    (this.world.solver as C.GSSolver).tolerance = 1e-4;

    this.groundMat = new C.Material({ friction: 0.8, restitution: 0.05 });
    this.zorbMat = new C.Material('zorb');
    this.ballMat = new C.Material('ball');
    this.cushionMat = new C.Material('cushion');
    this.postMat = new C.Material({ friction: 0.2, restitution: 0.6 });

    // Contact Materials
    // Zorb vs Zorb: Hyper-bouncy explosive elastic contact
    this.world.addContactMaterial(
      new C.ContactMaterial(this.zorbMat, this.zorbMat, {
        friction: 0.2,
        restitution: 0.4,
      }),
    );
    // Zorb vs Ball: High bounce
    this.world.addContactMaterial(
      new C.ContactMaterial(this.zorbMat, this.ballMat, {
        friction: 0.35,
        restitution: 0.55,
      }),
    );
    // Zorb vs Spring Cushion: Ultra bouncy bumper bounce
    this.world.addContactMaterial(
      new C.ContactMaterial(this.zorbMat, this.cushionMat, {
        friction: 0.05,
        restitution: 0.3,
      }),
    );
    // Ball vs Ground
    this.world.addContactMaterial(
      new C.ContactMaterial(this.ballMat, this.groundMat, {
        friction: 0.6,
        restitution: 0.35,
      }),
    );
    // Zorb vs Ground
    this.world.addContactMaterial(
      new C.ContactMaterial(this.zorbMat, this.groundMat, {
        friction: 0.5,
        restitution: 0.1,
      }),
    );
    // Ball vs Cushion
    this.world.addContactMaterial(
      new C.ContactMaterial(this.ballMat, this.cushionMat, {
        friction: 0.1,
        restitution: 0.5,
      }),
    );

    // Ground Plane
    const ground = new C.Body({ mass: 0, material: this.groundMat });
    ground.addShape(new C.Plane());
    ground.quaternion.setFromAxisAngle(vec(1, 0, 0), -Math.PI / 2);
    ground.position.set(0, 0, 0);
    this.world.addBody(ground);

    // Setup Ball
    this.ballBody = new C.Body({
      mass: BALL_MASS,
      material: this.ballMat,
      linearDamping: 0.1,
      angularDamping: 0.15,
    });
    this.ballBody.addShape(new C.Sphere(BALL_RADIUS));
    this.ballBody.position.set(state.ball.x, state.ball.y, state.ball.z);
    this.ballBody.velocity.set(state.ball.vx, state.ball.vy, state.ball.vz);
    this.ballBody.quaternion.set(
      state.ball.qx,
      state.ball.qy,
      state.ball.qz,
      state.ball.qw,
    );
    this.world.addBody(this.ballBody);

    // Build Boundary Cushions
    this.setupBoundaryCushions(state.cushions);

    // Build Ramps
    this.setupRamps(state.ramps);

    // Build Goals and Goal Detection Sensors
    const { sensorRed, sensorBlue } = this.setupGoals();
    this.goalSensorRed = sensorRed;
    this.goalSensorBlue = sensorBlue;

    // Synchronize initial players
    this.syncPlayers(state.players);
  }

  private setupBoundaryCushions(cushions: SpringCushion[]) {
    for (const c of cushions) {
      const body = new C.Body({
        mass: 0,
        material: this.cushionMat,
      });
      body.addShape(new C.Box(vec(c.width / 2, c.height / 2, c.depth / 2)));
      body.position.set(c.x, c.y, c.z);
      this.world.addBody(body);
      this.cushionBodies.push(body);
      const fence = new C.Body({ mass: 0, material: this.cushionMat });
      fence.addShape(
        new C.Box(vec(c.width / 2, (FENCE_HEIGHT - 1.9) / 2, c.depth / 2)),
      );
      fence.position.set(c.x, (FENCE_HEIGHT + 1.9) / 2, c.z);
      this.world.addBody(fence);
      this.cushionBodies.push(fence);
    }
  }

  private setupRamps(ramps: Ramp[]) {
    for (const r of ramps) {
      const body = new C.Body({
        mass: 0,
        material: this.groundMat,
      });
      // Ramp shaped using an inclined box
      const halfW = r.width / 2;
      const halfL = r.length / 2;
      const halfH = r.height / 2;
      body.addShape(new C.Box(vec(halfW, halfH, halfL)));
      body.position.set(r.x, r.y, r.z);

      // Tilt along local X by ~14 degrees (rise toward positive Z)
      const qTilt = new C.Quaternion();
      qTilt.setFromAxisAngle(vec(1, 0, 0), -0.24);
      const qRot = new C.Quaternion();
      qRot.setFromAxisAngle(vec(0, 1, 0), r.rotation);
      body.quaternion = qRot.mult(qTilt);

      this.world.addBody(body);
      this.rampBodies.push(body);
    }
  }

  private setupGoals() {
    const postRadius = POST_RADIUS;
    const halfGoalW = GOAL_WIDTH / 2;
    const goalZ = PITCH_LENGTH / 2;

    const buildGoalPosts = (sign: number) => {
      // Left and Right Posts
      for (const side of [-1, 1]) {
        const post = new C.Body({ mass: 0, material: this.postMat });
        post.addShape(
          new C.Cylinder(postRadius, postRadius, GOAL_HEIGHT, 10),
          vec(0, GOAL_HEIGHT / 2, 0),
        );
        post.position.set(side * halfGoalW, 0, sign * goalZ);
        this.world.addBody(post);
      }
      // Crossbar
      const bar = new C.Body({ mass: 0, material: this.postMat });
      bar.addShape(
        new C.Box(vec(halfGoalW, postRadius, postRadius)),
        vec(0, GOAL_HEIGHT, 0),
      );
      bar.position.set(0, 0, sign * goalZ);
      this.world.addBody(bar);

      // Back Net Wall
      const backNet = new C.Body({ mass: 0, material: this.postMat });
      backNet.addShape(
        new C.Box(vec(halfGoalW, GOAL_HEIGHT / 2, 0.2)),
        vec(0, GOAL_HEIGHT / 2, 0),
      );
      backNet.position.set(0, 0, sign * (goalZ + GOAL_DEPTH));
      this.world.addBody(backNet);

      const roof = new C.Body({ mass: 0, material: this.postMat });
      roof.addShape(new C.Box(vec(halfGoalW, 0.1, GOAL_DEPTH / 2)));
      roof.position.set(0, GOAL_HEIGHT + 0.1, sign * (goalZ + GOAL_DEPTH / 2));
      this.world.addBody(roof);
      const aboveGoal = new C.Body({ mass: 0, material: this.cushionMat });
      aboveGoal.addShape(
        new C.Box(vec(halfGoalW, (FENCE_HEIGHT - GOAL_HEIGHT) / 2, 0.2)),
      );
      aboveGoal.position.set(0, (FENCE_HEIGHT + GOAL_HEIGHT) / 2, sign * goalZ);
      this.world.addBody(aboveGoal);

      // Side Net Walls
      for (const side of [-1, 1]) {
        const sideNet = new C.Body({ mass: 0, material: this.postMat });
        sideNet.addShape(
          new C.Box(vec(0.2, GOAL_HEIGHT / 2, GOAL_DEPTH / 2)),
          vec(0, GOAL_HEIGHT / 2, 0),
        );
        sideNet.position.set(
          side * halfGoalW,
          0,
          sign * (goalZ + GOAL_DEPTH / 2),
        );
        this.world.addBody(sideNet);
      }
    };

    // Red Goal at South (-Z), Blue Goal at North (+Z)
    buildGoalPosts(-1);
    buildGoalPosts(1);

    // Goal Trigger Sensors (mass 0, isTrigger)
    const sensorRed = new C.Body({ isTrigger: true });
    sensorRed.addShape(
      new C.Box(vec(halfGoalW - 0.2, GOAL_HEIGHT / 2, GOAL_DEPTH / 2)),
      vec(0, GOAL_HEIGHT / 2, 0),
    );
    sensorRed.position.set(0, 0, -(goalZ + GOAL_DEPTH / 2));
    this.world.addBody(sensorRed);

    const sensorBlue = new C.Body({ isTrigger: true });
    sensorBlue.addShape(
      new C.Box(vec(halfGoalW - 0.2, GOAL_HEIGHT / 2, GOAL_DEPTH / 2)),
      vec(0, GOAL_HEIGHT / 2, 0),
    );
    sensorBlue.position.set(0, 0, goalZ + GOAL_DEPTH / 2);
    this.world.addBody(sensorBlue);

    return { sensorRed, sensorBlue };
  }

  syncPlayers(players: ZorbPlayer[]) {
    // Add missing players
    for (const p of players) {
      p.posture ??= p.turtle ? 'fallen' : 'upright';
      p.balance ??= p.turtle ? 1 : 0;
      p.heading ??= p.team === 'red' ? 0 : Math.PI;
      p.gait ??= 0;
      p.grounded ??= false;
      p.recovery ??= 0;
      p.fallX ??= 0;
      p.fallZ ??= 1;
      if (!this.playerBodies.has(p.id)) {
        const body = new C.Body({
          mass: PLAYER_MASS,
          material: this.zorbMat,
          linearDamping: 0.15,
          angularDamping: 0.2,
        });
        body.addShape(new C.Sphere(ZORB_RADIUS));
        body.position.set(p.x, p.y, p.z);
        body.velocity.set(p.vx, p.vy, p.vz);
        body.quaternion.set(p.qx, p.qy, p.qz, p.qw);
        this.world.addBody(body);
        this.playerBodies.set(p.id, body);

        // Add collision listener for explosive bonks
        body.addEventListener(
          'collide',
          (e: { body: C.Body; contact: C.ContactEquation }) => {
            this.handlePlayerCollision(p.id, body, e.body);
          },
        );
      }
    }

    // Remove deleted players
    for (const [id, body] of this.playerBodies.entries()) {
      if (!players.some((pl) => pl.id === id)) {
        this.world.removeBody(body);
        this.playerBodies.delete(id);
      }
    }
  }

  private fall(player: ZorbPlayer, direction: C.Vec3) {
    player.turtle = true;
    player.posture = 'fallen';
    player.balance = 1;
    player.recovery = 0;
    player.wiggleProgress = 0;
    player.turtleTimer = TURTLE_DURATION;
    player.dashCharge = 0;
    player.dashing = 0;
    player.braced = false;
    player.fallX = direction.x;
    player.fallZ = direction.z;
  }

  private handlePlayerCollision(pId: string, body: C.Body, other: C.Body) {
    const player = this.state.players.find((p) => p.id === pId);
    if (!player) return;
    if (other === this.ballBody) {
      // Attribution must include gentle touches, independently of audio thresholds.
      this.state.ball.lastTouchPlayerId = player.id;
      this.state.ball.lastTouchTeam = player.team;
      const speed = body.velocity.vsub(other.velocity).length();
      if (speed > 2)
        this.impacts.push({
          type: 'zorb_ball',
          x: other.position.x,
          y: other.position.y,
          z: other.position.z,
          intensity: Math.min(1, speed / 10),
          playerA: pId,
        });
      return;
    }
    const otherPlayer = this.state.players.find(
      (p) => this.playerBodies.get(p.id) === other,
    );
    const normal = body.position.vsub(other.position);
    if (normal.lengthSquared() < 1e-8) return;
    normal.normalize();
    const closingSpeed = Math.max(
      0,
      -body.velocity.vsub(other.velocity).dot(normal),
    );
    if (otherPlayer) {
      const key = [pId, otherPlayer.id].sort().join(':');
      if (this.contactPairs.has(key)) return;
      this.contactPairs.add(key);
      if (closingSpeed > 2)
        this.impacts.push({
          type: 'zorb_zorb',
          x: (body.position.x + other.position.x) / 2,
          y: (body.position.y + other.position.y) / 2,
          z: (body.position.z + other.position.z) / 2,
          intensity: Math.min(1, closingSpeed / 12),
          playerA: pId,
          playerB: otherPlayer.id,
        });
      // Cannon resolves momentum once. Never inject another pair of impulses here.
      for (const [p, dir] of [
        [player, normal],
        [otherPlayer, normal.negate()],
      ] as const) {
        if (closingSpeed > (p.braced ? 11 : 5.5)) this.fall(p, dir);
        else if (!p.turtle)
          p.balance = Math.min(0.95, p.balance + closingSpeed * 0.035);
      }
    } else if (this.cushionBodies.includes(other)) {
      if (closingSpeed > 2.5)
        this.impacts.push({
          type: 'cushion',
          x: body.position.x,
          y: body.position.y,
          z: body.position.z,
          intensity: Math.min(1, closingSpeed / 10),
          playerA: pId,
        });
      if (closingSpeed > 8 && !player.braced) this.fall(player, normal);
    }
  }

  step(dt: number) {
    this.impacts = [];
    this.pendingGoal = null;
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator + 1e-9 >= STEP) {
      this.contactPairs.clear();
      this.recoverOutOfBounds();
      const previousBall = this.ballBody.position.clone();
      this.applyPlayerInputs(STEP);
      for (const b of this.playerBodies.values()) this.limitSpeed(b, 17);
      this.limitSpeed(this.ballBody, 26);
      this.world.step(STEP);
      this.detectGoal(previousBall, this.ballBody.position);
      this.recoverOutOfBounds();
      for (const p of this.state.players) {
        const b = this.playerBodies.get(p.id)!;
        p.grounded = this.world.contacts.some(
          (c) =>
            (c.bi === b && -c.ni.y > 0.45) || (c.bj === b && c.ni.y > 0.45),
        );
        this.limitSpeed(b, 17);
      }
      this.limitSpeed(this.ballBody, 26);
      this.accumulator -= STEP;
      if (this.pendingGoal) {
        this.accumulator = 0;
        break;
      }
    }
    this.updateStateFromPhysics();
  }

  private limitSpeed(body: C.Body, max: number) {
    const speed = body.velocity.length();
    if (speed > max) body.velocity.scale(max / speed, body.velocity);
    const spin = body.angularVelocity.length();
    if (spin > 24) body.angularVelocity.scale(24 / spin, body.angularVelocity);
  }

  private applyPlayerInputs(dt: number) {
    for (const player of this.state.players) {
      const body = this.playerBodies.get(player.id);
      if (!body) continue;
      const input = player.input;
      const rawX = Number.isFinite(input.x) ? input.x : 0;
      const rawZ = Number.isFinite(input.z) ? input.z : 0;
      const len = Math.max(1, Math.hypot(rawX, rawZ));
      const x = rawX / len,
        z = rawZ / len;
      const moving = Math.hypot(x, z) > 0.1;
      const grounded =
        player.grounded ||
        (body.position.y <= ZORB_RADIUS + 0.06 &&
          Math.abs(body.velocity.y) < 0.5);
      const speed = Math.hypot(body.velocity.x, body.velocity.z);
      player.braced = input.brace && !player.turtle && grounded;
      body.linearDamping = player.turtle ? 0.25 : player.braced ? 0.8 : 0.12;
      body.angularDamping = player.turtle ? 0.25 : player.braced ? 0.8 : 0.15;
      player.dashing = Math.max(0, player.dashing - dt);

      if (player.turtle) {
        player.dashCharge = 0;
        player.dashing = 0;
        // Recovery is deliberately a hold action, explained identically on touch and keyboard.
        if (grounded && speed < 4.5 && Math.abs(body.velocity.y) < 1) {
          if (player.posture === 'recovering') {
            player.recovery = Math.min(1, player.recovery + dt / 0.65);
            if (player.recovery >= 1) {
              player.turtle = false;
              player.posture = 'upright';
              player.balance = 0;
              player.turtleTimer = 0;
              player.wiggleProgress = 0;
            }
          } else {
            player.turtleTimer = Math.max(0, player.turtleTimer - dt);
            player.wiggleProgress = Math.min(
              1,
              player.wiggleProgress +
                dt * (moving || input.wiggle ? 0.9 : 1 / TURTLE_DURATION),
            );
            if (player.wiggleProgress >= 1 || player.turtleTimer === 0)
              player.posture = 'recovering';
          }
        } else if (player.posture === 'recovering') {
          player.posture = 'fallen';
          player.recovery = 0;
        }
        continue;
      }

      // Abrupt changes at running speed challenge the human's balance, not the shell's up vector.
      const alignment =
        moving && speed > 0.1
          ? (x * body.velocity.x + z * body.velocity.z) / speed
          : 1;
      const turnStress =
        grounded && speed > 5 && alignment < 0.1 && !player.braced;
      player.balance = Math.max(
        0,
        Math.min(1, player.balance + dt * (turnStress ? 2.2 : -0.65)),
      );
      player.posture = player.balance > 0.4 ? 'unstable' : 'upright';
      if (player.balance >= 1) {
        this.fall(player, body.velocity);
        continue;
      }
      if (moving) {
        const targetHeading = Math.atan2(x, z);
        const delta = Math.atan2(
          Math.sin(targetHeading - player.heading),
          Math.cos(targetHeading - player.heading),
        );
        player.heading += delta * Math.min(1, dt * 10);
        if (grounded) player.gait += speed * dt * 2.6;
      }

      if (input.dash && !player.braced && grounded) {
        player.dashCharge = Math.min(
          1,
          player.dashCharge + dt / MAX_CHARGE_TIME,
        );
      } else {
        if (
          !input.dash &&
          player.dashCharge > 0.15 &&
          !player.braced &&
          grounded
        ) {
          const charge = player.dashCharge;
          const dx = moving ? x : Math.sin(player.heading);
          const dz = moving ? z : Math.cos(player.heading);
          body.applyImpulse(
            vec(
              dx * PLAYER_MASS * (3 + 4 * charge),
              0,
              dz * PLAYER_MASS * (3 + 4 * charge),
            ),
          );
          player.dashing = DASH_BURST_TIME;
        }
        player.dashCharge = 0;
      }

      if (grounded && player.dashing <= 0) {
        const targetSpeed = player.braced ? 1.2 : 6.5;
        let ax = (x * targetSpeed - body.velocity.x) * 5;
        let az = (z * targetSpeed - body.velocity.z) * 5;
        const accel = Math.hypot(ax, az);
        const maxAccel = player.braced ? 16 : 12;
        if (accel > maxAccel) {
          ax *= maxAccel / accel;
          az *= maxAccel / accel;
        }
        // Center-of-mass force. Ground friction produces shell rolling naturally.
        body.applyForce(vec(ax * PLAYER_MASS, 0, az * PLAYER_MASS));
      }
    }
  }

  private recoverOutOfBounds() {
    const outside = (b: C.Body) =>
      ![
        b.position.x,
        b.position.y,
        b.position.z,
        b.velocity.x,
        b.velocity.y,
        b.velocity.z,
      ].every(Number.isFinite) ||
      b.position.y < -2 ||
      b.position.y > 14 ||
      Math.abs(b.position.x) > PITCH_WIDTH / 2 + 1 ||
      Math.abs(b.position.z) > PITCH_LENGTH / 2 + GOAL_DEPTH + 1;
    for (const p of this.state.players) {
      const b = this.playerBodies.get(p.id);
      if (b && outside(b)) this.resetPlayer(p);
    }
    if (outside(this.ballBody)) this.resetBall();
  }

  resetBall() {
    this.ballBody.position.set(0, BALL_RADIUS + 0.1, 0);
    this.ballBody.velocity.set(0, 0, 0);
    this.ballBody.angularVelocity.set(0, 0, 0);
    this.ballBody.quaternion.set(0, 0, 0, 1);
    this.ballBody.force.set(0, 0, 0);
    this.ballBody.torque.set(0, 0, 0);
    this.ballBody.aabbNeedsUpdate = true;
    this.state.ball.lastTouchPlayerId = null;
    this.state.ball.lastTouchTeam = null;
    this.goalEntry = 0;
    this.pendingGoal = null;
    this.updateStateFromPhysics();
  }

  private resetPlayer(player: ZorbPlayer) {
    const body = this.playerBodies.get(player.id);
    if (!body) return;
    const teammates = this.state.players.filter((p) => p.team === player.team);
    const i = teammates.indexOf(player);
    let x = [-6, 0, 6][i % 3];
    let z = (player.team === 'red' ? -1 : 1) * (13 + Math.floor(i / 3) * 3);
    // Choose an unoccupied recovery location, including opponents.
    for (let attempt = 0; attempt < 30; attempt++) {
      if (
        ![...this.playerBodies.values()].some(
          (b) =>
            b !== body &&
            Math.hypot(b.position.x - x, b.position.z - z) <
              ZORB_RADIUS * 2 + 0.2,
        )
      )
        break;
      x = -12 + (attempt % 9) * 3;
      z = (player.team === 'red' ? -1 : 1) * (10 + Math.floor(attempt / 9) * 3);
    }
    body.position.set(x, ZORB_RADIUS + 0.1, z);
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.force.set(0, 0, 0);
    body.torque.set(0, 0, 0);
    body.quaternion.set(0, 0, 0, 1);
    body.aabbNeedsUpdate = true;
    Object.assign(player, {
      turtle: false,
      posture: 'upright',
      balance: 0,
      recovery: 0,
      turtleTimer: 0,
      wiggleProgress: 0,
      dashCharge: 0,
      dashing: 0,
      braced: false,
      heading: player.team === 'red' ? 0 : Math.PI,
      gait: 0,
      grounded: false,
      fallX: 0,
      fallZ: 1,
      input: { x: 0, z: 0, dash: false, brace: false, wiggle: false },
    });
  }

  resetPlayers() {
    for (const p of this.state.players) this.resetPlayer(p);
    this.accumulator = 0;
    this.updateStateFromPhysics();
  }

  private detectGoal(previous: C.Vec3, current: C.Vec3) {
    if (this.pendingGoal) return;
    const line = PITCH_LENGTH / 2;
    const insideOpening = (p: C.Vec3) =>
      Math.abs(p.x) <= GOAL_WIDTH / 2 - POST_RADIUS - BALL_RADIUS &&
      p.y >= BALL_RADIUS - 0.03 &&
      p.y <= GOAL_HEIGHT - POST_RADIUS - BALL_RADIUS;
    for (const sign of [-1, 1]) {
      const a = previous.z * sign,
        b = current.z * sign;
      if (b <= a) {
        if (b < line - BALL_RADIUS && this.goalEntry === sign)
          this.goalEntry = 0;
        continue;
      }
      const at = (z: number) => {
        const point = vec();
        previous.lerp(current, (z - a) / (b - a), point);
        return point;
      };
      if (a <= line - BALL_RADIUS && b > line - BALL_RADIUS) {
        this.goalEntry = insideOpening(at(line - BALL_RADIUS)) ? sign : 0;
      }
      if (this.goalEntry === sign && !insideOpening(current))
        this.goalEntry = 0;
      if (
        this.goalEntry === sign &&
        a < line + BALL_RADIUS &&
        b >= line + BALL_RADIUS &&
        insideOpening(at(line + BALL_RADIUS))
      ) {
        this.pendingGoal = { scored: true, team: sign === 1 ? 'red' : 'blue' };
        this.goalEntry = 0;
      }
    }
  }

  private updateStateFromPhysics() {
    // Update ball
    this.state.ball.x = this.ballBody.position.x;
    this.state.ball.y = this.ballBody.position.y;
    this.state.ball.z = this.ballBody.position.z;
    this.state.ball.vx = this.ballBody.velocity.x;
    this.state.ball.vy = this.ballBody.velocity.y;
    this.state.ball.vz = this.ballBody.velocity.z;
    this.state.ball.qx = this.ballBody.quaternion.x;
    this.state.ball.qy = this.ballBody.quaternion.y;
    this.state.ball.qz = this.ballBody.quaternion.z;
    this.state.ball.qw = this.ballBody.quaternion.w;

    // Update players
    for (const player of this.state.players) {
      const body = this.playerBodies.get(player.id);
      if (!body) continue;

      player.x = body.position.x;
      player.y = body.position.y;
      player.z = body.position.z;
      player.vx = body.velocity.x;
      player.vy = body.velocity.y;
      player.vz = body.velocity.z;
      player.qx = body.quaternion.x;
      player.qy = body.quaternion.y;
      player.qz = body.quaternion.z;
      player.qw = body.quaternion.w;
    }
  }

  checkGoal(): { scored: true; team: TeamId } | null {
    return this.pendingGoal;
  }
}
