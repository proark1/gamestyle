import * as T from 'three';
import { getEquippedLook } from '../../shared/wardrobe/wardrobe-state';
import {
  ballDropShadow,
  basketballBall,
  basketballCourt,
  basketballPlayer,
  playerContactShadow,
} from './models';
import { poseBasketballWorker, poseSpectatorWorker } from './avatar';
import {
  HOOP,
  idleInput,
  TEAM_COLORS,
  type BasketballAction,
  type BasketballSnapshot,
  type Player,
  type PlayerInput,
} from './types';
import { createRenderer } from '../../shared/rendering/create-renderer';
import {
  addHouseLight,
  HOUSE_EXPOSURE,
} from '../../shared/rendering/house-light';

type Callbacks = {
  input: (i: PlayerInput) => void;
  action: (a: BasketballAction) => void;
};

export class BasketballScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(46, 1, 0.1, 150);
  private renderer: T.WebGLRenderer;
  private courtGroup = basketballCourt();
  private ballMesh = basketballBall();
  private ballShadowMesh = ballDropShadow();
  private playerMeshes = new Map<string, T.Group>();
  private playerShadows = new Map<string, T.Mesh>();
  private ring: T.Mesh;
  private trajectoryPoints: T.Mesh[] = [];

  private keys = new Set<string>();
  private abort = new AbortController();
  private observer: ResizeObserver;
  private frameId = 0;
  private lastTime = performance.now();
  private localId = '';
  private currentInput: PlayerInput = idleInput();
  private lastSpacePress = 0;
  private isSpaceHeld = false;
  private cameraMode: 'iso' | 'follow' = 'iso';

  private lastEventId = 0;
  private rimRot = 0;
  private rimRotVel = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private targetCamPos = new T.Vector3(0, 16.2, 14.5);
  private targetCamLook = new T.Vector3(0, 1.8, -3.8);
  private currentCamPos = new T.Vector3(0, 16.2, 14.5);
  private currentCamLook = new T.Vector3(0, 1.8, -3.8);
  private zoomPunch = 0;
  private netSwishTimer = 0;
  private cheerTimer = 0;

  private confettiPool: {
    mesh: T.Mesh;
    vx: number;
    vy: number;
    vz: number;
    rx: number;
    ry: number;
    life: number;
    maxLife: number;
    active: boolean;
  }[] = [];

  private flamePool: {
    mesh: T.Mesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
    active: boolean;
  }[] = [];

  constructor(
    private container: HTMLDivElement,
    private cb: Callbacks,
  ) {
    this.renderer = createRenderer(container, {
      exposure: HOUSE_EXPOSURE,
      label:
        'Court Clash basketball arena. WASD moves, Space shoots/dunks, F crossovers, C spins, E passes/steals, Shift sprints, V switches camera.',
    }).renderer;

    // The collection's house light under the coast sky.
    const { sun } = addHouseLight(this.scene, { fog: { near: 38, far: 95 } });
    sun.position.set(-14, 26, 16);
    Object.assign(sun.shadow.camera, {
      left: -22,
      right: 22,
      top: 22,
      bottom: -22,
      near: 5,
      far: 75,
    });
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.04;

    // Court, Ball & Ball Drop Shadow
    this.scene.add(this.courtGroup);
    this.scene.add(this.ballShadowMesh);
    this.scene.add(this.ballMesh);

    // Stack or Sink signature yellow target ring
    this.ring = new T.Mesh(
      new T.RingGeometry(0.65, 0.76, 32),
      new T.MeshBasicMaterial({
        color: '#ffe181',
        side: T.DoubleSide,
        depthTest: false,
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.scene.add(this.ring);

    // Shot trajectory indicator dots
    const dotGeo = new T.SphereGeometry(0.08, 8, 6);
    const dotMat = new T.MeshBasicMaterial({
      color: '#ffe181',
      transparent: true,
      opacity: 0.85,
    });
    for (let i = 0; i < 7; i++) {
      const dot = new T.Mesh(dotGeo, dotMat);
      dot.visible = false;
      this.trajectoryPoints.push(dot);
      this.scene.add(dot);
    }

    // Initialize 3D Confetti Particle Pool: both team colours, gold and white
    const confettiColors = [
      TEAM_COLORS.red,
      TEAM_COLORS.blue,
      '#ffe181',
      '#ffffff',
    ];
    const confGeo = new T.BoxGeometry(0.12, 0.08, 0.02);
    for (let i = 0; i < 50; i++) {
      const col = confettiColors[i % confettiColors.length];
      const mat = new T.MeshBasicMaterial({
        color: col,
        side: T.DoubleSide,
        transparent: true,
        opacity: 1,
      });
      const mesh = new T.Mesh(confGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.confettiPool.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        life: 0,
        maxLife: 1.2,
        active: false,
      });
    }

    // Initialize Flame Particle Pool
    const flameGeo = new T.SphereGeometry(0.12, 6, 4);
    for (let i = 0; i < 35; i++) {
      const mat = new T.MeshBasicMaterial({
        color: i % 2 === 0 ? '#ff471a' : '#fbc531',
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new T.Mesh(flameGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.flamePool.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.45,
        active: false,
      });
    }

    this.updateCameraPosition();

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();

    const signal = this.abort.signal;
    window.addEventListener('keydown', this.keyDown, { signal });
    window.addEventListener('keyup', this.keyUp, { signal });
    window.addEventListener('blur', this.resetInput, { signal });

    this.frameId = requestAnimationFrame(this.renderLoop);
  }

  private spawnConfettiBurst(x: number, y: number, z: number) {
    for (const p of this.confettiPool) {
      if (!p.active) {
        p.active = true;
        p.mesh.visible = true;
        p.mesh.position.set(
          x + (Math.random() - 0.5) * 0.4,
          y + (Math.random() - 0.5) * 0.4,
          z + (Math.random() - 0.5) * 0.4,
        );
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 4.5;
        p.vx = Math.cos(angle) * speed;
        p.vy = 3.5 + Math.random() * 4.0;
        p.vz = Math.sin(angle) * speed;
        p.rx = (Math.random() - 0.5) * 12;
        p.ry = (Math.random() - 0.5) * 12;
        p.life = 0;
        p.maxLife = 0.9 + Math.random() * 0.6;
      }
    }
  }

  private spawnFlame(x: number, y: number, z: number, boostY = 0) {
    const p = this.flamePool.find((f) => !f.active);
    if (!p) return;
    p.active = true;
    p.mesh.visible = true;
    p.mesh.position.set(
      x + (Math.random() - 0.5) * 0.25,
      y + (Math.random() - 0.5) * 0.2,
      z + (Math.random() - 0.5) * 0.25,
    );
    p.vx = (Math.random() - 0.5) * 0.8;
    p.vy = 1.2 + Math.random() * 1.5 + boostY;
    p.vz = (Math.random() - 0.5) * 0.8;
    p.life = 0;
    p.maxLife = 0.35 + Math.random() * 0.2;
    p.mesh.scale.setScalar(1.0);
  }

  private updateCameraPosition(player?: Player) {
    if (this.cameraMode === 'follow' && player) {
      this.targetCamPos.set(player.x * 0.75, player.y + 6.8, player.z + 9.5);
      this.targetCamLook.set(player.x * 0.5, 2.0, HOOP.z * 0.55);
    } else {
      // Classic Stack or Sink isometric perspective with subtle focal action tracking
      const focalX = player ? player.x * 0.22 : 0;
      const focalZ = player ? -3.8 + (player.z - -3.8) * 0.18 : -3.8;
      this.targetCamPos.set(focalX, 16.2, 14.2);
      this.targetCamLook.set(focalX * 0.5, 1.8, focalZ);
    }
  }

  private resize() {
    if (!this.container) return;
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private keyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.keys.add(e.code);

    const now = Date.now();

    if (e.code === 'Space') {
      // Check for Step-back Jumper when moving backward
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
        this.cb.action({ type: 'stepback' });
      }
      // Check for Super Jump double-tap
      if (now - this.lastSpacePress < 320) {
        this.cb.action({ type: 'superJump' });
      }
      this.lastSpacePress = now;
      this.isSpaceHeld = true;
    }

    if (e.code === 'KeyF') {
      this.cb.action({ type: 'crossover' });
    }

    if (e.code === 'KeyC') {
      this.cb.action({ type: 'spin' });
    }

    if (e.code === 'KeyE') {
      this.cb.action({ type: 'pass' });
      this.cb.action({ type: 'steal' });
    }

    if (e.code === 'KeyQ') {
      this.cb.action({ type: 'steal' });
    }

    if (e.code === 'KeyV') {
      this.cameraMode = this.cameraMode === 'iso' ? 'follow' : 'iso';
    }

    this.syncInput();
  };

  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);

    if (e.code === 'Space') {
      this.isSpaceHeld = false;
    }

    this.syncInput();
  };

  private resetInput = () => {
    this.keys.clear();
    this.isSpaceHeld = false;
    this.syncInput();
  };

  private syncInput() {
    let x = 0;
    let z = 0;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;

    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    this.currentInput = {
      x,
      z,
      shoot: this.isSpaceHeld,
      pass: this.keys.has('KeyE'),
      steal: this.keys.has('KeyQ'),
      sprint,
      crossover: this.keys.has('KeyF'),
      spin: this.keys.has('KeyC'),
      seq: this.currentInput.seq + 1,
    };

    this.cb.input(this.currentInput);
  }

  render(snap: BasketballSnapshot) {
    this.localId = snap.localId;
    const world = snap.world;
    const now = world.clock;

    // Check for new game events for visual FX (Shake, Rim Impulse, Confetti, Cheer, Net Ripple)
    for (const ev of world.events) {
      if (ev.id <= this.lastEventId) continue;
      this.lastEventId = ev.id;

      if (
        ev.type === 'dunk' ||
        ev.type === 'superdunk' ||
        ev.type === 'alleyoop' ||
        ev.type === 'swish'
      ) {
        const isSuper = ev.type === 'superdunk';
        this.shakeTimer = isSuper ? 0.55 : 0.4;
        this.shakeIntensity = isSuper ? 0.48 : 0.26;
        this.rimRotVel = isSuper ? -18.0 : -13.0;
        this.netSwishTimer = 0.75;
        this.cheerTimer = 3.0;
        this.zoomPunch = isSuper ? 1.3 : 0.85;

        if (ev.type !== 'swish') {
          this.spawnConfettiBurst(HOOP.x, HOOP.y, HOOP.z);
        }
        if (isSuper) {
          for (let i = 0; i < 8; i++) {
            this.spawnFlame(HOOP.x, HOOP.y + 0.2, HOOP.z, 2.0);
          }
        }
      } else if (ev.type === 'rim') {
        this.rimRotVel = -5.5;
        this.netSwishTimer = 0.35;
      } else if (ev.type === 'rimhang') {
        this.rimRotVel = -8.5;
        this.netSwishTimer = 0.5;
      } else if (ev.type === 'anklebreaker') {
        this.shakeTimer = 0.3;
        this.shakeIntensity = 0.22;
        this.cheerTimer = 2.0;
        this.zoomPunch = 0.55;
      }
    }

    // 1. Render ball & dynamic drop shadow
    this.ballMesh.position.set(world.ball.x, world.ball.y, world.ball.z);
    this.ballShadowMesh.position.set(world.ball.x, 0.024, world.ball.z);
    const heightAboveCourt = Math.max(0, world.ball.y - 0.24);
    const shadowScale = Math.max(0.35, 1.0 - heightAboveCourt * 0.12);
    this.ballShadowMesh.scale.set(shadowScale, shadowScale, shadowScale);
    (this.ballShadowMesh.material as T.MeshBasicMaterial).opacity = Math.max(
      0.08,
      0.58 - heightAboveCourt * 0.07,
    );

    if (!world.ball.heldBy) {
      if (Math.hypot(world.ball.vx, world.ball.vz) > 0.4) {
        this.ballMesh.rotation.x += world.ball.vz * 0.08;
        this.ballMesh.rotation.z -= world.ball.vx * 0.08;
      }
      if (world.ball.vy !== 0) {
        this.ballMesh.rotation.x -= 0.12; // backspin on flight
      }
      if (world.ball.isSuperShot) {
        this.spawnFlame(world.ball.x, world.ball.y, world.ball.z);
      }
    }

    // 2. Render players & player contact shadows
    const activeIds = new Set<string>();
    let localPlayer: Player | undefined;

    for (const p of world.players) {
      activeIds.add(p.id);
      if (p.id === this.localId) localPlayer = p;

      let mesh = this.playerMeshes.get(p.id);
      // Players wear their team's kit, so switching team in the lobby needs a
      // fresh model.
      if (mesh && mesh.userData.team !== p.team) {
        this.scene.remove(mesh);
        mesh = undefined;
      }
      if (!mesh) {
        const look = p.bot ? undefined : getEquippedLook();
        mesh = basketballPlayer(p.team, look);
        mesh.userData.team = p.team;
        this.playerMeshes.set(p.id, mesh);
        this.scene.add(mesh);
      }

      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y =
        p.specialMove === 'spin' ? p.facing + p.spinAngle : p.facing;

      // Contact shadow beneath each player
      let pShadow = this.playerShadows.get(p.id);
      if (!pShadow) {
        pShadow = playerContactShadow();
        this.playerShadows.set(p.id, pShadow);
        this.scene.add(pShadow);
      }
      pShadow.position.set(p.x, 0.022, p.z);
      const pAir = Math.max(0, p.y);
      const pScale = Math.max(0.35, 1.0 - pAir * 0.14);
      pShadow.scale.set(pScale, pScale, pScale);
      (pShadow.material as T.MeshBasicMaterial).opacity = Math.max(
        0.06,
        0.35 - pAir * 0.08,
      );

      const moving = Math.hypot(p.vx, p.vz) > 0.4;
      const dunking =
        p.specialMove === 'dunk' ||
        (!p.grounded &&
          p.hasBall &&
          Math.hypot(p.x - HOOP.x, p.z - HOOP.z) < 3.5);
      const shooting = p.chargingShot || (!p.grounded && p.hasBall);
      const defending = !p.hasBall && !p.chargingShot && p.grounded && !moving;
      const tilt = Math.max(-0.22, Math.min(0.22, -p.vx * 0.04));

      // On Fire flame aura
      if (p.combo >= 80 || p.superJump) {
        if (Math.random() < 0.4) {
          this.spawnFlame(p.x, p.y + 0.8, p.z);
        }
      }

      poseBasketballWorker(mesh, now * 0.001, {
        moving,
        shooting,
        dunking:
          p.specialMove === 'dunk'
            ? p.dunkType === 'windmill360'
              ? 'windmill'
              : p.dunkType === 'powerhang'
                ? 'hang'
                : 'tomahawk'
            : dunking,
        hanging: p.specialMove === 'hang' || p.hangUntil > now,
        celebrating: p.specialMove === 'celebrate' || p.celebrateUntil > now,
        stumbled: p.specialMove === 'stumbled' || p.stunnedUntil > now,
        crossover: p.specialMove === 'crossover',
        spinning: p.specialMove === 'spin',
        dribbling:
          p.hasBall && !shooting && !dunking && p.specialMove !== 'dunk',
        defending,
        tilt,
        color: p.color,
        still:
          !moving &&
          !shooting &&
          !dunking &&
          !p.hasBall &&
          p.specialMove === 'none',
      });
    }

    // Remove obsolete player meshes and shadows
    for (const [id, mesh] of this.playerMeshes) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.playerMeshes.delete(id);
      }
    }
    for (const [id, shadow] of this.playerShadows) {
      if (!activeIds.has(id)) {
        this.scene.remove(shadow);
        this.playerShadows.delete(id);
      }
    }

    // 3. Update ground targeting ring on local player
    if (localPlayer) {
      this.ring.position.set(localPlayer.x, 0.03, localPlayer.z);
      this.ring.visible = true;

      // Trajectory dots preview when charging shot
      if (localPlayer.chargingShot && localPlayer.hasBall) {
        for (let i = 0; i < this.trajectoryPoints.length; i++) {
          const t = (i + 1) * 0.12;
          const px = localPlayer.x + (HOOP.x - localPlayer.x) * (t / 0.8);
          const pz = localPlayer.z + (HOOP.z - localPlayer.z) * (t / 0.8);
          const py = Math.max(0.1, 1.8 + 6.0 * t - 0.5 * 13.5 * t * t);
          this.trajectoryPoints[i].position.set(px, py, pz);
          this.trajectoryPoints[i].visible = true;
        }
      } else {
        for (const dot of this.trajectoryPoints) {
          dot.visible = false;
        }
      }

      this.updateCameraPosition(localPlayer);
    } else {
      this.ring.visible = false;
      this.updateCameraPosition();
    }
  }

  private renderLoop = (time: number) => {
    this.frameId = requestAnimationFrame(this.renderLoop);
    const dt = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;

    // 1. Breakaway spring rim physics
    const springK = 240;
    const damping = 16;
    this.rimRotVel += (-this.rimRot * springK - this.rimRotVel * damping) * dt;
    this.rimRot += this.rimRotVel * dt;
    const rimAssembly = this.courtGroup.userData.rimAssembly as
      | T.Group
      | undefined;
    if (rimAssembly) {
      rimAssembly.rotation.x = this.rimRot;
    }

    // 2. Net ripple / swish animation on score / dunk
    if (this.netSwishTimer > 0) {
      this.netSwishTimer = Math.max(0, this.netSwishTimer - dt);
      const netMesh = this.courtGroup.userData.netMesh as T.Mesh | undefined;
      if (netMesh) {
        const progress = this.netSwishTimer / 0.75;
        const wave = Math.sin(time * 0.028) * 0.28 * progress;
        netMesh.scale.set(1.0 + wave, 1.0 - progress * 0.15, 1.0 + wave);
      }
    } else {
      const netMesh = this.courtGroup.userData.netMesh as T.Mesh | undefined;
      if (netMesh && (netMesh.scale.x !== 1 || netMesh.scale.y !== 1)) {
        netMesh.scale.set(1, 1, 1);
      }
    }

    // 3. Bleacher spectators cheering and idle animation
    if (this.cheerTimer > 0) {
      this.cheerTimer = Math.max(0, this.cheerTimer - dt);
    }
    const spectators = this.courtGroup.userData.spectators as
      | T.Group[]
      | undefined;
    if (spectators) {
      for (let i = 0; i < spectators.length; i++) {
        poseSpectatorWorker(
          spectators[i],
          time * 0.001,
          i * 1.1,
          this.cheerTimer > 0,
        );
      }
    }

    // 4. Smooth Damped Camera Motion & Zoom Punch
    const lerpFactor = Math.min(1, dt * 6.5);
    this.currentCamPos.lerp(this.targetCamPos, lerpFactor);
    this.currentCamLook.lerp(this.targetCamLook, lerpFactor);

    this.camera.position.copy(this.currentCamPos);

    if (this.zoomPunch > 0.01) {
      this.zoomPunch = Math.max(0, this.zoomPunch - dt * 2.2);
      this.camera.position.z -= this.zoomPunch * 1.5;
      this.camera.position.y -= this.zoomPunch * 0.8;
    }

    this.camera.lookAt(this.currentCamLook);

    // Camera shake
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      const intensity = this.shakeIntensity * (this.shakeTimer / 0.5);
      this.camera.position.x += (Math.random() - 0.5) * intensity;
      this.camera.position.y += (Math.random() - 0.5) * intensity;
    }

    // 5. Update Confetti particles
    for (const p of this.confettiPool) {
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          p.vy -= 9.8 * dt; // gravity
          p.vx *= 0.97;
          p.vz *= 0.97;
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.mesh.rotation.x += p.rx * dt;
          p.mesh.rotation.y += p.ry * dt;
          const alpha = Math.max(0, 1 - p.life / p.maxLife);
          (p.mesh.material as T.MeshBasicMaterial).opacity = alpha;
        }
      }
    }

    // 6. Update Flame particles
    for (const p of this.flamePool) {
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          const scale = Math.max(0.1, 1 - p.life / p.maxLife);
          p.mesh.scale.setScalar(scale);
          (p.mesh.material as T.MeshBasicMaterial).opacity = scale;
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.abort.abort();
    this.observer.disconnect();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(
        this.renderer.domElement,
      );
    }
  }
}
