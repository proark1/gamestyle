import * as C from 'cannon-es';
import {
  BALL_RADIUS,
  GOAL_DEPTH,
  GOAL_HEIGHT,
  GOAL_WIDTH,
  PITCH_LENGTH,
  ZORB_RADIUS,
  type Ramp,
  type SpringCushion,
  type TeamId,
  type ZorbClashWorld,
  type ZorbPlayer,
} from './types';

export const STEP = 1 / 60;
export const PLAYER_MASS = 70;
export const BRACED_MASS = 250;
export const BALL_MASS = 3.5;
export const ROLL_FORCE = 620;
export const MAX_CHARGE_TIME = 1.2;
export const DASH_BURST_TIME = 0.35;
export const TURTLE_DURATION = 3.5; // seconds before auto-righting

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

  constructor(public state: ZorbClashWorld) {
    this.world = new C.World({
      gravity: vec(0, -18, 0), // Snappy, arcade gravity
      allowSleep: false,
    });
    this.world.solver = new C.GSSolver();
    (this.world.solver as C.GSSolver).iterations = 15;
    (this.world.solver as C.GSSolver).tolerance = 1e-4;

    this.groundMat = new C.Material({ friction: 0.8, restitution: 0.05 });
    this.zorbMat = new C.Material({ friction: 0.3, restitution: 0.85 });
    this.ballMat = new C.Material({ friction: 0.4, restitution: 0.88 });
    this.cushionMat = new C.Material({ friction: 0.1, restitution: 0.98 });
    this.postMat = new C.Material({ friction: 0.2, restitution: 0.6 });

    // Contact Materials
    // Zorb vs Zorb: Hyper-bouncy explosive elastic contact
    this.world.addContactMaterial(
      new C.ContactMaterial(this.zorbMat, this.zorbMat, {
        friction: 0.2,
        restitution: 0.92,
      }),
    );
    // Zorb vs Ball: High bounce
    this.world.addContactMaterial(
      new C.ContactMaterial(this.zorbMat, this.ballMat, {
        friction: 0.35,
        restitution: 0.88,
      }),
    );
    // Zorb vs Spring Cushion: Ultra bouncy bumper bounce
    this.world.addContactMaterial(
      new C.ContactMaterial(this.zorbMat, this.cushionMat, {
        friction: 0.05,
        restitution: 1.0,
      }),
    );
    // Ball vs Ground
    this.world.addContactMaterial(
      new C.ContactMaterial(this.ballMat, this.groundMat, {
        friction: 0.6,
        restitution: 0.75,
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
        restitution: 0.95,
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
    const postRadius = 0.16;
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
      if (!this.playerBodies.has(p.id)) {
        const body = new C.Body({
          mass: PLAYER_MASS,
          material: this.zorbMat,
          linearDamping: 0.15,
          angularDamping: 0.2,
        });
        body.addShape(new C.Sphere(ZORB_RADIUS));
        body.position.set(p.x, p.y, p.z);
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

  private handlePlayerCollision(
    pId: string,
    playerBody: C.Body,
    otherBody: C.Body,
  ) {
    // Check if other body is another player
    for (const [otherId, oBody] of this.playerBodies.entries()) {
      if (oBody === otherBody && otherId !== pId) {
        // Relative velocity
        const relV = playerBody.velocity.vsub(oBody.velocity);
        const speed = relV.length();

        if (speed > 3.0) {
          const normal = playerBody.position.vsub(oBody.position);
          if (normal.lengthSquared() > 1e-4) {
            normal.normalize();
            // Explosive elastic impulse!
            const impulseMag = Math.min(speed * 320, 3200);
            playerBody.applyImpulse(
              normal.scale(impulseMag),
              playerBody.position,
            );
            oBody.applyImpulse(normal.scale(-impulseMag), oBody.position);

            this.impacts.push({
              type: 'zorb_zorb',
              x: (playerBody.position.x + oBody.position.x) / 2,
              y: (playerBody.position.y + oBody.position.y) / 2,
              z: (playerBody.position.z + oBody.position.z) / 2,
              intensity: Math.min(1.0, speed / 12),
              playerA: pId,
              playerB: otherId,
            });

            // If collision is very hard, trigger turtle state!
            if (speed > 8.0) {
              const pA = this.state.players.find((pl) => pl.id === pId);
              const pB = this.state.players.find((pl) => pl.id === otherId);
              // If not braced, turtle them!
              if (pA && !pA.braced) {
                pA.turtle = true;
                pA.turtleTimer = TURTLE_DURATION;
              }
              if (pB && !pB.braced) {
                pB.turtle = true;
                pB.turtleTimer = TURTLE_DURATION;
              }
            } else {
              // Moderate hit: if someone was already turtle'd, hitting them can right them up!
              const pA = this.state.players.find((pl) => pl.id === pId);
              const pB = this.state.players.find((pl) => pl.id === otherId);
              if (pA?.turtle) {
                pA.turtle = false;
                pA.turtleTimer = 0;
              }
              if (pB?.turtle) {
                pB.turtle = false;
                pB.turtleTimer = 0;
              }
            }
          }
        }
        return;
      }
    }

    // Check if other body is the ball
    if (otherBody === this.ballBody) {
      const relV = playerBody.velocity.vsub(this.ballBody.velocity);
      const speed = relV.length();
      if (speed > 2.0) {
        this.impacts.push({
          type: 'zorb_ball',
          x: this.ballBody.position.x,
          y: this.ballBody.position.y,
          z: this.ballBody.position.z,
          intensity: Math.min(1.0, speed / 10),
          playerA: pId,
        });
      }
      return;
    }

    // Check if other body is a spring cushion
    if (this.cushionBodies.includes(otherBody)) {
      const speed = playerBody.velocity.length();
      if (speed > 2.5) {
        this.impacts.push({
          type: 'cushion',
          x: playerBody.position.x,
          y: playerBody.position.y,
          z: playerBody.position.z,
          intensity: Math.min(1.0, speed / 10),
          playerA: pId,
        });
      }
    }
  }

  step(dt: number) {
    this.impacts = [];
    this.applyPlayerInputs(dt);
    this.world.step(STEP, dt, 3);
    this.updateStateFromPhysics();
  }

  private applyPlayerInputs(dt: number) {
    for (const player of this.state.players) {
      const body = this.playerBodies.get(player.id);
      if (!body) continue;

      const input = player.input;

      // Handle Brace Stance (Shift)
      if (input.brace && !player.turtle) {
        player.braced = true;
        body.mass = BRACED_MASS;
        body.updateMassProperties();
        body.linearDamping = 0.85;
        body.angularDamping = 0.95;
      } else {
        player.braced = false;
        body.mass = PLAYER_MASS;
        body.updateMassProperties();
        body.linearDamping = 0.15;
        body.angularDamping = 0.2;
      }

      // Handle Bumper Dash Charging and Burst (Space)
      if (input.dash && !player.turtle && !player.braced) {
        player.dashCharge = Math.min(
          1.0,
          player.dashCharge + dt / MAX_CHARGE_TIME,
        );
      } else if (!input.dash && player.dashCharge > 0.15 && !player.turtle) {
        // Trigger Bumper Dash Burst!
        const charge = player.dashCharge;
        player.dashCharge = 0;
        player.dashing = DASH_BURST_TIME;

        // Direction from input or current forward direction
        let dirX = input.x;
        let dirZ = input.z;
        if (Math.abs(dirX) < 0.1 && Math.abs(dirZ) < 0.1) {
          // Forward based on velocity or default
          if (body.velocity.lengthSquared() > 0.5) {
            dirX = body.velocity.x;
            dirZ = body.velocity.z;
          } else {
            dirZ = player.team === 'red' ? 1 : -1;
          }
        }
        const len = Math.hypot(dirX, dirZ);
        if (len > 0.01) {
          dirX /= len;
          dirZ /= len;
          const burstImpulse = 700 + charge * 1500;
          body.applyImpulse(
            vec(dirX * burstImpulse, 140 * charge, dirZ * burstImpulse),
            body.position,
          );
        }
      } else {
        player.dashCharge = 0;
      }

      if (player.dashing > 0) {
        player.dashing = Math.max(0, player.dashing - dt);
      }

      // Handle Upside-Down Turtle State
      // Check if body is inverted (up vector Y < 0.15)
      const up = body.quaternion.vmult(vec(0, 1, 0));
      if (up.y < 0.15 && body.position.y < ZORB_RADIUS + 0.6) {
        if (!player.turtle) {
          player.turtle = true;
          player.turtleTimer = TURTLE_DURATION;
          player.wiggleProgress = 0;
        }
      }

      if (player.turtle) {
        // Player is turtle'd: reduce traction, flail legs
        body.linearDamping = 0.08;
        body.angularDamping = 0.05;

        // Wiggling reduces turtle timer
        if (
          input.wiggle ||
          Math.abs(input.x) > 0.4 ||
          Math.abs(input.z) > 0.4
        ) {
          player.wiggleProgress += dt * 0.9;
          // Apply a comical wiggle torque to wobble
          const wobble = (Math.random() - 0.5) * 80;
          body.applyTorque(vec(wobble, (Math.random() - 0.5) * 60, wobble));
          if (player.wiggleProgress >= 1.0) {
            player.turtle = false;
            player.turtleTimer = 0;
            player.wiggleProgress = 0;
            // Pop upright!
            this.rightPlayerUp(body);
          }
        }

        player.turtleTimer -= dt;
        if (player.turtleTimer <= 0) {
          player.turtle = false;
          player.turtleTimer = 0;
          player.wiggleProgress = 0;
          this.rightPlayerUp(body);
        }
      } else {
        // Normal Movement rolling force
        if (Math.abs(input.x) > 0.01 || Math.abs(input.z) > 0.01) {
          const moveForce = player.braced ? ROLL_FORCE * 0.35 : ROLL_FORCE;
          body.applyForce(
            vec(input.x * moveForce, 0, input.z * moveForce),
            body.position,
          );

          // Rolling torque for natural rolling motion
          const torqueMag = moveForce * 0.3;
          body.applyTorque(vec(input.z * torqueMag, 0, -input.x * torqueMag));
        }
      }

      // Keep inside bounds if knocked out
      if (body.position.y < -5) {
        body.position.set(
          player.team === 'red' ? -6 : 6,
          2,
          player.team === 'red' ? -12 : 12,
        );
        body.velocity.set(0, 0, 0);
      }
    }

    // Keep ball in bounds
    if (this.ballBody.position.y < -5) {
      this.resetBall();
    }
  }

  private rightPlayerUp(body: C.Body) {
    // Smoothly restore upright quaternion and pop slightly up
    const qTarget = new C.Quaternion();
    qTarget.setFromAxisAngle(vec(0, 1, 0), 0);
    body.quaternion = qTarget;
    body.angularVelocity.set(0, 0, 0);
    body.applyImpulse(vec(0, 160, 0), body.position);
  }

  resetBall() {
    this.ballBody.position.set(0, BALL_RADIUS + 0.5, 0);
    this.ballBody.velocity.set(0, 0, 0);
    this.ballBody.angularVelocity.set(0, 0, 0);
  }

  resetPlayers() {
    const redSpawns = [
      vec(-5, ZORB_RADIUS + 0.2, -14),
      vec(5, ZORB_RADIUS + 0.2, -14),
      vec(0, ZORB_RADIUS + 0.2, -18),
    ];
    const blueSpawns = [
      vec(-5, ZORB_RADIUS + 0.2, 14),
      vec(5, ZORB_RADIUS + 0.2, 14),
      vec(0, ZORB_RADIUS + 0.2, 18),
    ];

    let rIdx = 0;
    let bIdx = 0;

    for (const player of this.state.players) {
      const body = this.playerBodies.get(player.id);
      if (!body) continue;
      const spawn =
        player.team === 'red'
          ? redSpawns[rIdx++ % redSpawns.length]
          : blueSpawns[bIdx++ % blueSpawns.length];

      body.position.copy(spawn);
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.quaternion.setFromAxisAngle(
        vec(0, 1, 0),
        player.team === 'red' ? 0 : Math.PI,
      );

      player.turtle = false;
      player.turtleTimer = 0;
      player.wiggleProgress = 0;
      player.dashCharge = 0;
      player.dashing = 0;
      player.braced = false;
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

  checkGoal(): { scored: boolean; team: TeamId; isTurtleGoal: boolean } | null {
    const ballPos = this.ballBody.position;
    const goalZ = PITCH_LENGTH / 2;
    const halfW = GOAL_WIDTH / 2;

    // Ball inside Red Goal (South: -Z) -> Blue Scores!
    if (
      ballPos.z < -goalZ &&
      ballPos.z > -(goalZ + GOAL_DEPTH + 1) &&
      Math.abs(ballPos.x) < halfW &&
      ballPos.y < GOAL_HEIGHT + 0.5
    ) {
      return { scored: true, team: 'blue', isTurtleGoal: false };
    }

    // Ball inside Blue Goal (North: +Z) -> Red Scores!
    if (
      ballPos.z > goalZ &&
      ballPos.z < goalZ + GOAL_DEPTH + 1 &&
      Math.abs(ballPos.x) < halfW &&
      ballPos.y < GOAL_HEIGHT + 0.5
    ) {
      return { scored: true, team: 'red', isTurtleGoal: false };
    }

    // Check if any turtle'd player was punted into the goal!
    for (const p of this.state.players) {
      if (!p.turtle) continue;
      const b = this.playerBodies.get(p.id);
      if (!b) continue;

      if (
        b.position.z < -goalZ &&
        b.position.z > -(goalZ + GOAL_DEPTH + 1) &&
        Math.abs(b.position.x) < halfW &&
        b.position.y < GOAL_HEIGHT + 0.5
      ) {
        // Red goal: Blue scored a TURTLE GOAL!
        return { scored: true, team: 'blue', isTurtleGoal: true };
      }

      if (
        b.position.z > goalZ &&
        b.position.z < goalZ + GOAL_DEPTH + 1 &&
        Math.abs(b.position.x) < halfW &&
        b.position.y < GOAL_HEIGHT + 0.5
      ) {
        // Blue goal: Red scored a TURTLE GOAL!
        return { scored: true, team: 'red', isTurtleGoal: true };
      }
    }

    return null;
  }
}
