import * as C from 'cannon-es';
import {
  CRANE_CONFIG,
  CRATE_CONFIGS,
  PAD_SIZE,
  PAD_Y,
  TEAMS,
  clamp,
  type Crate,
  type CraneClashWorld,
  type Player,
  type PlayerInput,
  type TeamId,
} from './types';

export const STEP = 1 / 60;
export const SWINGER_MASS = 75;
export const SWINGER_RADIUS = 0.55;
export const SWINGER_HEIGHT = 1.6;
export const SWING_FORCE = 320;
export const SWING_PUMP_BOOST = 280;
export const SLEW_SPEED = 1.35; // radians per second
export const TROLLEY_SPEED = 4.2; // meters per second
export const HOIST_SPEED = 3.5; // meters per second
export const GRAB_REACH = 2.4; // Reach radius to grab an unheld crate

const vec = (x = 0, y = 0, z = 0) => new C.Vec3(x, y, z);

export class CraneClashPhysics {
  world: C.World;
  groundMaterial: C.Material;
  crateMaterial: C.Material;
  padMaterial: C.Material;
  swingerMaterial: C.Material;

  hoists = new Map<TeamId, C.Body>();
  swingers = new Map<TeamId, C.Body>();
  cables = new Map<TeamId, C.DistanceConstraint>();
  crateBodies = new Map<string, C.Body>();
  padBodies = new Map<TeamId, C.Body>();

  collisions: { type: 'bonk' | 'crate'; team?: TeamId }[] = [];

  constructor(public state: CraneClashWorld) {
    this.world = new C.World({
      gravity: vec(0, -9.81, 0),
      allowSleep: true,
    });
    this.world.solver = new C.GSSolver();
    (this.world.solver as C.GSSolver).iterations = 20;
    (this.world.solver as C.GSSolver).tolerance = 1e-5;

    this.groundMaterial = new C.Material({ friction: 0.75, restitution: 0.04 });
    this.crateMaterial = new C.Material({ friction: 0.7, restitution: 0.05 });
    this.padMaterial = new C.Material({ friction: 0.85, restitution: 0.02 });
    this.swingerMaterial = new C.Material({ friction: 0.1, restitution: 0.1 });

    // Contact materials
    this.world.addContactMaterial(
      new C.ContactMaterial(this.groundMaterial, this.crateMaterial, {
        friction: 0.7,
        restitution: 0.05,
      }),
    );
    this.world.addContactMaterial(
      new C.ContactMaterial(this.crateMaterial, this.crateMaterial, {
        friction: 0.75,
        restitution: 0.04,
      }),
    );
    this.world.addContactMaterial(
      new C.ContactMaterial(this.padMaterial, this.crateMaterial, {
        friction: 0.85,
        restitution: 0.02,
      }),
    );
    this.world.addContactMaterial(
      new C.ContactMaterial(this.swingerMaterial, this.crateMaterial, {
        friction: 0.2,
        restitution: 0.1,
      }),
    );

    // Ground plane
    const ground = new C.Body({ mass: 0, material: this.groundMaterial });
    ground.addShape(new C.Plane());
    ground.quaternion.setFromAxisAngle(vec(1, 0, 0), -Math.PI / 2);
    ground.position.set(0, 0, 0);
    this.world.addBody(ground);

    // Build platform pads for both teams
    for (const team of TEAMS) {
      const cfg = CRANE_CONFIG[team];
      const pad = new C.Body({
        mass: 0,
        material: this.padMaterial,
      });
      pad.addShape(new C.Box(vec(PAD_SIZE / 2, PAD_Y / 2, PAD_SIZE / 2)));
      pad.position.set(cfg.pad.x, PAD_Y / 2, cfg.pad.z);
      this.world.addBody(pad);
      this.padBodies.set(team, pad);
    }

    // Cranes & Swingers
    for (const team of TEAMS) {
      const crane = state.cranes[team];
      const cfg = CRANE_CONFIG[team];

      // Hoist anchor (kinematic, driven by operator)
      const hoist = new C.Body({ mass: 0 });
      hoist.position.set(crane.trolleyX, cfg.boomY - 0.4, crane.trolleyZ);
      this.world.addBody(hoist);
      this.hoists.set(team, hoist);

      // Swinger body (suspended at crane.hookX, hookY, hookZ)
      const swinger = new C.Body({
        mass: SWINGER_MASS,
        material: this.swingerMaterial,
        linearDamping: 0.04,
        angularDamping: 0.3,
        allowSleep: false,
      });
      swinger.addShape(new C.Sphere(SWINGER_RADIUS));
      swinger.position.set(crane.hookX, crane.hookY, crane.hookZ);
      swinger.velocity.set(crane.hookVx, crane.hookVy, crane.hookVz);
      this.world.addBody(swinger);
      this.swingers.set(team, swinger);

      // Cable distance constraint
      const cable = new C.DistanceConstraint(
        hoist,
        swinger,
        crane.cableLength,
        SWINGER_MASS * 500,
      );
      this.world.addConstraint(cable);
      this.cables.set(team, cable);

      // Listener for mid-air player bonks
      swinger.addEventListener('collide', (event: { body: C.Body }) => {
        const otherSwinger =
          team === 'orange'
            ? this.swingers.get('teal')
            : this.swingers.get('orange');
        if (event.body === otherSwinger) {
          this.collisions.push({ type: 'bonk', team });
        }
      });
    }

    // Crates
    for (const crate of state.crates) {
      this.addCrateBody(crate);
    }
  }

  addCrateBody(crate: Crate) {
    const config = CRATE_CONFIGS[crate.kind];
    const isHeld = !!crate.heldBy;
    const body = new C.Body({
      mass: isHeld ? 0 : config.mass,
      material: this.crateMaterial,
      linearDamping: 0.08,
      angularDamping: 0.15,
      allowSleep: true,
      sleepSpeedLimit: 0.1,
      sleepTimeLimit: 0.5,
    });
    body.addShape(new C.Box(vec(config.w / 2, config.h / 2, config.d / 2)));
    body.position.set(crate.x, crate.y, crate.z);
    if (crate.quaternion) {
      body.quaternion.set(
        crate.quaternion.x,
        crate.quaternion.y,
        crate.quaternion.z,
        crate.quaternion.w,
      );
    }
    if (!isHeld) {
      body.velocity.set(crate.vx, crate.vy, crate.vz);
      if (crate.angular) {
        body.angularVelocity.set(
          crate.angular.x,
          crate.angular.y,
          crate.angular.z,
        );
      }
      if (crate.sleeping) body.sleep();
    }
    this.world.addBody(body);
    this.crateBodies.set(crate.id, body);
  }

  driveOperator(team: TeamId, input: PlayerInput, dt: number) {
    const crane = this.state.cranes[team];
    const cfg = CRANE_CONFIG[team];
    const hoist = this.hoists.get(team);
    if (!hoist) return;

    // Slew rotation
    if (input.x !== 0) {
      crane.angle += input.x * SLEW_SPEED * dt;
    }

    // Trolley distance
    if (input.z !== 0) {
      crane.trolleyDist = clamp(
        crane.trolleyDist + input.z * TROLLEY_SPEED * dt,
        cfg.reachMin,
        cfg.reachMax,
      );
    }

    // Hoist cable length
    if (input.y && input.y !== 0) {
      crane.cableLength = clamp(
        crane.cableLength - input.y * HOIST_SPEED * dt,
        2.5,
        cfg.boomY - 1.2,
      );
      const cable = this.cables.get(team);
      if (cable) cable.distance = crane.cableLength;
    }

    // Update hoist position
    crane.trolleyX = cfg.mast.x + Math.cos(crane.angle) * crane.trolleyDist;
    crane.trolleyZ = cfg.mast.z + Math.sin(crane.angle) * crane.trolleyDist;
    hoist.position.set(crane.trolleyX, cfg.boomY - 0.4, crane.trolleyZ);
  }

  driveSwinger(team: TeamId, input: PlayerInput) {
    const swinger = this.swingers.get(team);
    if (!swinger) return;

    const ix = input.x;
    const iz = input.z;
    const inputLen = Math.hypot(ix, iz);
    if (inputLen > 0.01) {
      const dirX = ix / inputLen;
      const dirZ = iz / inputLen;

      // Base directional swing force
      swinger.applyForce(
        vec(dirX * SWING_FORCE, 0, dirZ * SWING_FORCE),
        swinger.position,
      );

      // Pumping momentum: check alignment with current horizontal velocity
      const vx = swinger.velocity.x;
      const vz = swinger.velocity.z;
      const horizSpeed = Math.hypot(vx, vz);
      if (horizSpeed > 0.4) {
        const velDirX = vx / horizSpeed;
        const velDirZ = vz / horizSpeed;
        const dot = dirX * velDirX + dirZ * velDirZ;
        if (dot > 0.2) {
          // Pumping in the direction of motion!
          const pump = SWING_PUMP_BOOST * dot;
          swinger.applyForce(
            vec(velDirX * pump, 0, velDirZ * pump),
            swinger.position,
          );
        } else if (dot < -0.3) {
          // Braking against swing motion
          swinger.velocity.x *= 0.96;
          swinger.velocity.z *= 0.96;
        }
      }
    }
  }

  grabCrate(swingerPlayer: Player): string | null {
    if (swingerPlayer.holdingCrateId) return null;
    const team = swingerPlayer.team;
    const swinger = this.swingers.get(team);
    if (!swinger) return null;

    // Find nearest unheld crate within GRAB_REACH
    let bestDist = GRAB_REACH;
    let targetCrate: Crate | null = null;
    for (const crate of this.state.crates) {
      if (crate.heldBy) continue;
      const dist = Math.hypot(
        crate.x - swinger.position.x,
        crate.y - swinger.position.y,
        crate.z - swinger.position.z,
      );
      if (dist < bestDist) {
        bestDist = dist;
        targetCrate = crate;
      }
    }

    if (targetCrate) {
      targetCrate.heldBy = swingerPlayer.id;
      swingerPlayer.holdingCrateId = targetCrate.id;
      const body = this.crateBodies.get(targetCrate.id);
      if (body) {
        body.mass = 0;
        body.updateMassProperties();
      }
      return targetCrate.id;
    }
    return null;
  }

  releaseCrate(swingerPlayer: Player): string | null {
    if (!swingerPlayer.holdingCrateId) return null;
    const crateId = swingerPlayer.holdingCrateId;
    const crate = this.state.crates.find((c) => c.id === crateId);
    const swinger = this.swingers.get(swingerPlayer.team);
    if (!crate || !swinger) return null;

    crate.heldBy = null;
    swingerPlayer.holdingCrateId = null;

    const body = this.crateBodies.get(crateId);
    if (body) {
      const config = CRATE_CONFIGS[crate.kind];
      body.mass = config.mass;
      body.updateMassProperties();
      body.wakeUp();
      // Impart tangential throw velocity with slight upward pop
      body.velocity.set(
        swinger.velocity.x * 1.15,
        swinger.velocity.y + 0.6,
        swinger.velocity.z * 1.15,
      );
    }
    return crateId;
  }

  step(dt = STEP) {
    // Keep held crates attached under swinger
    for (const p of this.state.players) {
      if (p.role === 'swinger' && p.holdingCrateId) {
        const swinger = this.swingers.get(p.team);
        const crateBody = this.crateBodies.get(p.holdingCrateId);
        const crate = this.state.crates.find((c) => c.id === p.holdingCrateId);
        if (swinger && crateBody && crate) {
          const config = CRATE_CONFIGS[crate.kind];
          crateBody.position.set(
            swinger.position.x,
            swinger.position.y - SWINGER_RADIUS - config.h / 2 - 0.1,
            swinger.position.z,
          );
          crateBody.velocity.copy(swinger.velocity);
        }
      }
    }

    this.world.step(STEP, dt, 3);

    // Read back crane swinger states
    for (const team of TEAMS) {
      const crane = this.state.cranes[team];
      const swinger = this.swingers.get(team);
      if (swinger) {
        crane.hookX = swinger.position.x;
        crane.hookY = swinger.position.y;
        crane.hookZ = swinger.position.z;
        crane.hookVx = swinger.velocity.x;
        crane.hookVy = swinger.velocity.y;
        crane.hookVz = swinger.velocity.z;

        // Swinger player representation coordinates
        const player = this.state.players.find(
          (p) => p.team === team && p.role === 'swinger',
        );
        if (player) {
          player.x = crane.hookX;
          player.y = crane.hookY;
          player.z = crane.hookZ;
          player.vx = crane.hookVx;
          player.vy = crane.hookVy;
          player.vz = crane.hookVz;
          if (Math.hypot(crane.hookVx, crane.hookVz) > 0.3) {
            player.facing = Math.atan2(crane.hookVx, crane.hookVz);
          }
        }
      }
    }

    // Read back crate positions
    for (const crate of this.state.crates) {
      const body = this.crateBodies.get(crate.id);
      if (body) {
        crate.x = body.position.x;
        crate.y = body.position.y;
        crate.z = body.position.z;
        crate.vx = body.velocity.x;
        crate.vy = body.velocity.y;
        crate.vz = body.velocity.z;
        crate.quaternion = {
          x: body.quaternion.x,
          y: body.quaternion.y,
          z: body.quaternion.z,
          w: body.quaternion.w,
        };
        crate.angular = {
          x: body.angularVelocity.x,
          y: body.angularVelocity.y,
          z: body.angularVelocity.z,
        };
        crate.sleeping = body.sleepState === C.Body.SLEEPING;
      }
    }
  }

  /** Calculate current stable tower heights on each team's pad */
  calculateHeights(): Record<TeamId, { height: number; crates: number }> {
    const result: Record<TeamId, { height: number; crates: number }> = {
      orange: { height: 0, crates: 0 },
      teal: { height: 0, crates: 0 },
    };

    for (const team of TEAMS) {
      const cfg = CRANE_CONFIG[team];
      const padX = cfg.pad.x;
      const padZ = cfg.pad.z;
      const padHalf = PAD_SIZE / 2 + 0.3; // Small tolerance

      let maxHeight = 0;
      let count = 0;

      for (const crate of this.state.crates) {
        if (crate.heldBy) continue;
        const config = CRATE_CONFIGS[crate.kind];
        // Check within horizontal pad boundaries
        const onPadX = Math.abs(crate.x - padX) <= padHalf;
        const onPadZ = Math.abs(crate.z - padZ) <= padHalf;
        const abovePad = crate.y >= PAD_Y;
        const speed = Math.hypot(crate.vx, crate.vy, crate.vz);

        if (onPadX && onPadZ && abovePad && speed < 1.4) {
          crate.teamPad = team;
          count++;
          const crateTop = crate.y + config.h / 2;
          const relativeHeight = Math.max(0, crateTop - PAD_Y);
          if (relativeHeight > maxHeight) {
            maxHeight = relativeHeight;
          }
        } else if (crate.teamPad === team) {
          crate.teamPad = null; // Fell off pad!
        }
      }

      result[team] = {
        height: Math.round(maxHeight * 10) / 10,
        crates: count,
      };
    }

    return result;
  }
}
