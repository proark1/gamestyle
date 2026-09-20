import { courtCameraDistance, courtViewport, movementAxes } from './controls';
import { disposeObject } from '../../shared/rendering/dispose-object';
import * as T from 'three';
import { getEquippedLook } from '../../shared/wardrobe/wardrobe-state';
import {
  createBungeeCord,
  createLandingTarget,
  tennisBall,
  tennisCourt,
  tennisPlayer,
} from './models';
import { poseTennisWorker } from './avatar';
import {
  idleInput,
  type BungeeAction,
  type BungeeSnapshot,
  type PlayerInput,
  type TeamId,
} from './types';
import { computeCameraRelativeMovement } from './physics';
import { createRenderer } from '../../shared/rendering/create-renderer';
import {
  addHouseLight,
  HOUSE_EXPOSURE,
  SKY,
} from '../../shared/rendering/house-light';

type Callbacks = {
  input: (i: PlayerInput) => void;
  action: (a: BungeeAction) => void;
};

export class BungeeScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(46, 1, 0.1, 150);
  private renderer: T.WebGLRenderer;
  private viewport = { width: 1, height: 1, bottom: 0 };
  private courtGroup = tennisCourt();
  private ballMesh = tennisBall();
  private landingTarget = createLandingTarget();
  private playerMeshes = new Map<string, T.Group>();
  private bungeeCords: Record<TeamId, ReturnType<typeof createBungeeCord>>;

  private keys = new Set<string>();
  private stick = { x: 0, z: 0 };
  private inputEnabled = true;
  private cancelPointer: () => void = () => {};

  setTouchMovement(vector: { x: number; z: number }) {
    this.stick = vector;
  }

  clearInput() {
    this.keys.clear();
    this.stick = { x: 0, z: 0 };
    this.cancelPointer();
    this.cb.input(idleInput());
  }

  setInputEnabled(enabled: boolean) {
    if (this.inputEnabled !== enabled) this.clearInput();
    this.inputEnabled = enabled;
  }
  private abort = new AbortController();
  private observer: ResizeObserver;
  private frameId = 0;
  private lastTime = performance.now();
  private localId = '';
  private currentInput: PlayerInput = idleInput();
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private lastHandledEventId = -1;
  private currentCamLook = new T.Vector3(0, 1.0, 0);

  // 360 Orbit Camera state
  private defaultYaw = Math.atan2(-14.2, -9.6);
  private defaultPitch = 0.667;
  private defaultDist = 21.82;
  private currentYaw = this.defaultYaw;
  private targetYaw = this.defaultYaw;
  private currentPitch = this.defaultPitch;
  private targetPitch = this.defaultPitch;
  private currentDist = this.defaultDist;
  private targetDist = this.defaultDist;
  private baseCamPos = new T.Vector3(-14.2, 13.5, -9.6);

  private presetIndex = 0;
  private readonly cameraPresets = [
    {
      name: 'Broadcast 3/4',
      yaw: Math.atan2(-14.2, -9.6),
      pitch: 0.67,
      dist: 21.8,
    },
    { name: 'Red Baseline', yaw: -Math.PI, pitch: 0.48, dist: 20.5 },
    { name: 'Sideline View', yaw: -Math.PI / 2, pitch: 0.6, dist: 22.0 },
    { name: 'Blue Baseline', yaw: 0, pitch: 0.48, dist: 20.5 },
    { name: 'Blue Corner', yaw: 0.98, pitch: 0.67, dist: 21.8 },
  ];

  // Particle pool for racket hits, glass sparks & victory confetti
  private particlePool: {
    mesh: T.Mesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
    active: boolean;
  }[] = [];

  // Ball motion trail pool
  private trailPool: {
    mesh: T.Mesh;
    life: number;
    maxLife: number;
    active: boolean;
  }[] = [];

  constructor(
    private container: HTMLDivElement,
    private cb: Callbacks,
  ) {
    this.renderer = createRenderer(this.container, {
      exposure: HOUSE_EXPOSURE,
      focusable: true,
      label:
        'Bungee Doubles court. Move with WASD or arrows, Space to hit, E to smash, Shift to dive, J to jump.',
    }).renderer;

    // Bungee cords for both teams
    this.bungeeCords = {
      red: createBungeeCord('red'),
      blue: createBungeeCord('blue'),
    };
    this.scene.add(this.bungeeCords.red.group);
    this.scene.add(this.bungeeCords.blue.group);

    this.setupScene();
    this.setupLighting();
    this.setupParticles();
    this.setupTrail();
    this.setupInputs();

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.container);
    this.resize();

    this.animate();
  }

  private setupScene() {
    this.scene.add(this.courtGroup);
    this.scene.add(this.ballMesh);
    this.scene.add(this.landingTarget.mesh);

    // Initialize 360 camera position looking at court center
    const horizDist = this.currentDist * Math.cos(this.currentPitch);
    const camX = this.currentCamLook.x + horizDist * Math.sin(this.currentYaw);
    const camY =
      this.currentCamLook.y + this.currentDist * Math.sin(this.currentPitch);
    const camZ = this.currentCamLook.z + horizDist * Math.cos(this.currentYaw);
    this.baseCamPos.set(camX, camY, camZ);
    this.camera.position.copy(this.baseCamPos);
    this.camera.lookAt(this.currentCamLook);
    this.camera.updateMatrixWorld();
  }

  private setupLighting() {
    const { sun } = addHouseLight(this.scene, {
      sky: SKY.coast,
      fog: { near: 60, far: 130 },
    });
    sun.position.set(16, 26, 12);
    sun.shadow.camera.near = 6;
    sun.shadow.camera.far = 70;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    sun.shadow.bias = -0.0003;
  }

  private setupParticles() {
    const geo = new T.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new T.MeshBasicMaterial({ color: '#ffea00' });
    for (let i = 0; i < 60; i++) {
      const mesh = new T.Mesh(geo, mat.clone());
      mesh.visible = false;
      this.scene.add(mesh);
      this.particlePool.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
        active: false,
      });
    }
  }

  private setupTrail() {
    const geo = new T.SphereGeometry(0.16, 8, 6);
    const mat = new T.MeshBasicMaterial({
      color: '#fff37a',
      transparent: true,
      opacity: 0.7,
    });
    for (let i = 0; i < 16; i++) {
      const mesh = new T.Mesh(geo, mat.clone());
      mesh.visible = false;
      this.scene.add(mesh);
      this.trailPool.push({
        mesh,
        life: 0,
        maxLife: 0.22,
        active: false,
      });
    }
  }

  private spawnHitPuff(
    pos: [number, number, number],
    color = '#ffea00',
    count = 8,
    speed = 5,
  ) {
    let spawned = 0;
    for (const p of this.particlePool) {
      if (!p.active) {
        p.active = true;
        p.mesh.visible = true;
        (p.mesh.material as T.MeshBasicMaterial).color.set(color);
        p.mesh.position.set(pos[0], pos[1], pos[2]);
        p.vx = (Math.random() - 0.5) * speed;
        p.vy = Math.random() * (speed * 0.8) + 1.5;
        p.vz = (Math.random() - 0.5) * speed;
        p.life = 0;
        p.maxLife = 0.3 + Math.random() * 0.25;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  private spawnConfetti(pos: [number, number, number]) {
    const confettiColors = [
      '#ff3366',
      '#ffd166',
      '#06d6a0',
      '#118ab2',
      '#ffffff',
    ];
    for (let i = 0; i < 24; i++) {
      const col = confettiColors[i % confettiColors.length];
      this.spawnHitPuff(pos, col, 1, 8);
    }
  }

  private spawnBallTrail(x: number, y: number, z: number, color = '#fff37a') {
    for (const t of this.trailPool) {
      if (!t.active) {
        t.active = true;
        t.mesh.visible = true;
        (t.mesh.material as T.MeshBasicMaterial).color.set(color);
        t.mesh.position.set(x, y, z);
        t.life = 0;
        t.mesh.scale.set(1, 1, 1);
        break;
      }
    }
  }

  private setupInputs() {
    const { signal } = this.abort;

    window.addEventListener(
      'keydown',
      (e) => {
        if (
          !this.inputEnabled ||
          (e.target instanceof HTMLElement &&
            (e.target.closest(
              'input, textarea, select, [contenteditable], [role=dialog]',
            ) ||
              (e.target.closest('button') &&
                ['Space', 'Enter'].includes(e.code))))
        )
          return;
        if (
          ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
            e.code,
          )
        )
          e.preventDefault();
        if (e.repeat) return;
        this.keys.add(e.code);

        if (e.code === 'Space') {
          e.preventDefault();
          this.cb.action({ type: 'swing' });
        } else if (e.code === 'KeyE') {
          e.preventDefault();
          this.cb.action({ type: 'smash' });
        } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          e.preventDefault();
          this.cb.action({ type: 'dive' });
        } else if (e.code === 'KeyJ' || (e.code === 'KeyW' && e.altKey)) {
          this.cb.action({ type: 'jump' });
        } else if (e.code === 'KeyC') {
          e.preventDefault();
          this.cycleCameraView();
        }
      },
      { signal },
    );

    window.addEventListener(
      'keyup',
      (e) => {
        this.keys.delete(e.code);
      },
      { signal },
    );

    const dom = this.renderer.domElement;
    dom.style.touchAction = 'none';
    dom.style.cursor = 'grab';

    let isPointerDown = false;
    let pointerId: number | null = null;
    let downButton = 0;
    let dragStartX = 0;
    let dragStartY = 0;
    let lastX = 0;
    let lastY = 0;
    let hasDragged = false;

    dom.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.inputEnabled || pointerId !== null) return;
        pointerId = e.pointerId;
        dom.focus({ preventScroll: true });
        isPointerDown = true;
        downButton = e.button;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        lastX = e.clientX;
        lastY = e.clientY;
        hasDragged = false;
        dom.style.cursor = 'grabbing';
        try {
          dom.setPointerCapture(e.pointerId);
        } catch {}
      },
      { signal },
    );

    dom.addEventListener(
      'pointermove',
      (e) => {
        if (!isPointerDown || e.pointerId !== pointerId) return;
        const totalDist = Math.hypot(
          e.clientX - dragStartX,
          e.clientY - dragStartY,
        );
        if (totalDist > 4) {
          hasDragged = true;
        }
        if (hasDragged) {
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          lastX = e.clientX;
          lastY = e.clientY;
          const rotSpeed = 0.007;
          this.targetYaw -= dx * rotSpeed;
          this.targetPitch = Math.max(
            0.18,
            Math.min(1.3, this.targetPitch + dy * rotSpeed),
          );
        }
      },
      { signal },
    );

    const endPointer = (e: PointerEvent) => {
      if (!isPointerDown || e.pointerId !== pointerId) return;
      pointerId = null;
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {}
      dom.style.cursor = 'grab';
      isPointerDown = false;

      if (!hasDragged && this.inputEnabled) {
        // Quick click / tap triggers swing or smash
        if (downButton === 0) {
          this.cb.action({ type: 'swing' });
        } else if (downButton === 2) {
          this.cb.action({ type: 'smash' });
        }
      }
      hasDragged = false;
    };

    dom.addEventListener('pointerup', endPointer, { signal });
    this.cancelPointer = () => {
      const id = pointerId;
      pointerId = null;
      isPointerDown = false;
      hasDragged = false;
      dom.style.cursor = 'grab';
      if (id !== null && dom.hasPointerCapture(id))
        dom.releasePointerCapture(id);
    };
    const cancel = (event: PointerEvent) => {
      if (event.pointerId === pointerId) this.cancelPointer();
    };
    dom.addEventListener('pointercancel', cancel, { signal });
    dom.addEventListener('lostpointercapture', cancel, { signal });
    window.addEventListener('blur', () => this.clearInput(), { signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.clearInput();
      },
      { signal },
    );

    // Scroll wheel zoom
    dom.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.targetDist = Math.max(
          this.defaultDist,
          Math.min(34, this.targetDist + e.deltaY * 0.015),
        );
      },
      { signal, passive: false },
    );

    dom.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
  }

  private pollInput(dt: number) {
    // Keyboard camera orbiting with Q and R
    if (this.keys.has('KeyQ')) {
      this.targetYaw -= 1.8 * dt;
    }
    if (this.keys.has('KeyR')) {
      this.targetYaw += 1.8 * dt;
    }

    if (!this.inputEnabled || document.hidden) return;
    const axes = movementAxes(this.keys, this.stick);
    const worldMove = computeCameraRelativeMovement(
      axes.x,
      axes.z,
      this.camera.matrixWorld.elements,
    );
    worldMove.x *= axes.magnitude;
    worldMove.z *= axes.magnitude;

    const nextInput: PlayerInput = {
      x: worldMove.x,
      z: worldMove.z,
      swing: this.keys.has('Space'),
      smash: this.keys.has('KeyE'),
      dive: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      jump: false,
      seq: this.currentInput.seq + 1,
    };

    this.currentInput = nextInput;
    this.cb.input(nextInput);
  }

  render(snap: BungeeSnapshot) {
    this.localId = snap.localId;
    const { world } = snap;
    // The world clock is in ms; the animation helpers take seconds.
    const seconds = world.clock / 1000;

    // Update ball
    this.ballMesh.position.set(world.ball.x, world.ball.y, world.ball.z);
    this.ballMesh.rotation.x += world.ball.vx * 0.15;
    this.ballMesh.rotation.z += world.ball.vz * 0.15;

    // Update landing indicator and contact shadow with clock
    this.landingTarget.update(
      world.ball.x,
      world.ball.z,
      world.ball.y,
      seconds,
    );

    // Dynamic ball speed trail on high-velocity shots and smashes
    const ballSpeed = Math.hypot(world.ball.vx, world.ball.vy, world.ball.vz);
    if (world.ball.speedTrail || world.ball.isSmash || ballSpeed > 11) {
      const trailColor = world.ball.isSmash ? '#ff3700' : '#ffe600';
      this.spawnBallTrail(world.ball.x, world.ball.y, world.ball.z, trailColor);
    }

    // Update or create player meshes
    const currentIds = new Set(world.players.map((p) => p.id));
    for (const [id, mesh] of this.playerMeshes) {
      if (!currentIds.has(id)) {
        this.scene.remove(mesh);
        disposeObject(mesh);
        this.playerMeshes.delete(id);
      }
    }

    for (const p of world.players) {
      let mesh = this.playerMeshes.get(p.id);
      // Players wear their team's kit, so switching team needs a fresh model.
      if (mesh && mesh.userData.team !== p.team) {
        this.scene.remove(mesh);
        disposeObject(mesh);
        mesh = undefined;
      }
      if (!mesh) {
        const isLocal = p.id === snap.localId;
        const look = isLocal ? getEquippedLook() : undefined;
        mesh = tennisPlayer(p.team, look);
        mesh.userData.team = p.team;
        if (isLocal) {
          const marker = new T.Mesh(
            new T.RingGeometry(0.55, 0.68, 32),
            new T.MeshBasicMaterial({ color: '#fff4a8', side: T.DoubleSide }),
          );
          marker.rotation.x = -Math.PI / 2;
          marker.position.y = 0.025;
          mesh.add(marker);
        }
        this.scene.add(mesh);
        this.playerMeshes.set(p.id, mesh);
      }

      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y = p.facing;

      const walking = Math.hypot(p.vx, p.vz) > 0.4;
      poseTennisWorker(mesh, seconds, {
        walking,
        specialState: p.specialState,
      });
    }

    // Update bungee cords between teammates with tension vibration and clock
    for (const team of ['red', 'blue'] as const) {
      const teamPlayers = world.players.filter((p) => p.team === team);
      const tether = world.tethers[team];
      if (teamPlayers.length >= 2 && tether) {
        this.bungeeCords[team].group.visible = true;
        this.bungeeCords[team].update(
          [teamPlayers[0].x, teamPlayers[0].y, teamPlayers[0].z],
          [teamPlayers[1].x, teamPlayers[1].y, teamPlayers[1].z],
          tether.tension,
          seconds,
        );
      } else {
        this.bungeeCords[team].group.visible = false;
      }
    }

    // Process fresh events once for visual fx and subtle micro-haptics
    for (const event of world.events) {
      if (event.id <= this.lastHandledEventId) continue;
      this.lastHandledEventId = Math.max(this.lastHandledEventId, event.id);

      if (event.type === 'smash_hit') {
        this.triggerScreenShake(0.04, 0.08); // Subtle, snappy micro-pulse
        if (event.pos) this.spawnHitPuff(event.pos, '#ff3700', 12, 6);
      } else if (event.type === 'partner_bonk') {
        this.triggerScreenShake(0.06, 0.1); // Small tactile bonk
        if (event.pos) this.spawnHitPuff(event.pos, '#ffcc00', 10, 5);
      } else if (event.type === 'wall_rebound') {
        if (event.pos) this.spawnHitPuff(event.pos, '#90e0ef', 8, 4); // Cyan-glass sparkle
      } else if (event.type === 'dive') {
        if (event.pos) this.spawnHitPuff(event.pos, '#cbd5e1', 10, 3); // Turf dust puff
      } else if (event.type === 'point_scored' || event.type === 'game_won') {
        this.spawnConfetti(event.pos ?? [0, 2, 0]);
      } else if (event.type === 'racket_hit') {
        if (event.pos) this.spawnHitPuff(event.pos, '#ffff00', 6, 4);
      }
    }

    // Keep the whole court framed; the local player has a pale ground ring.
  }

  cycleCameraView(): string {
    this.presetIndex = (this.presetIndex + 1) % this.cameraPresets.length;
    const preset = this.cameraPresets[this.presetIndex];

    // Find shortest angular path to target preset yaw
    let diff = preset.yaw - (this.targetYaw % (Math.PI * 2));
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    this.targetYaw += diff;
    this.targetPitch = preset.pitch;
    this.targetDist = preset.dist;
    return preset.name;
  }

  rotateCamera(deltaYaw: number) {
    this.targetYaw += deltaYaw;
  }

  private triggerScreenShake(intensity: number, duration: number) {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  private animate = () => {
    this.frameId = requestAnimationFrame(this.animate);
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // Smoothly interpolate camera spherical coordinates
    const blend = 1 - Math.pow(0.86, dt * 60);
    this.currentYaw += (this.targetYaw - this.currentYaw) * blend;
    this.currentPitch += (this.targetPitch - this.currentPitch) * blend;
    this.currentDist += (this.targetDist - this.currentDist) * blend;

    const distance =
      Math.max(1, this.currentDist / this.defaultDist) *
      courtCameraDistance(
        this.currentYaw,
        this.currentPitch,
        this.camera.aspect,
      );
    const horizDist = distance * Math.cos(this.currentPitch);
    const camX = this.currentCamLook.x + horizDist * Math.sin(this.currentYaw);
    const camY = this.currentCamLook.y + distance * Math.sin(this.currentPitch);
    const camZ = this.currentCamLook.z + horizDist * Math.cos(this.currentYaw);
    this.baseCamPos.set(camX, camY, camZ);

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.set(camX + shakeOffsetX, camY + shakeOffsetY, camZ);
    } else {
      this.camera.position.set(camX, camY, camZ);
    }
    this.camera.lookAt(this.currentCamLook);
    this.camera.updateMatrixWorld();

    this.pollInput(dt);

    // Update ball trails
    for (const t of this.trailPool) {
      if (t.active) {
        t.life += dt;
        if (t.life >= t.maxLife) {
          t.active = false;
          t.mesh.visible = false;
        } else {
          const scale = 1 - t.life / t.maxLife;
          t.mesh.scale.set(scale, scale, scale);
        }
      }
    }

    // Update particles
    for (const p of this.particlePool) {
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          p.vy -= 12.0 * dt;
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          const scale = 1 - p.life / p.maxLife;
          p.mesh.scale.set(scale, scale, scale);
        }
      }
    }

    // Shared adaptive quality can reset the GL viewport when changing DPR.
    this.renderer.setViewport(
      0,
      this.viewport.bottom,
      this.viewport.width,
      this.viewport.height,
    );
    this.renderer.render(this.scene, this.camera);
  };

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    const style = getComputedStyle(this.container);
    const safeTop =
      parseFloat(style.getPropertyValue('--bungee-safe-top')) || 0;
    const safeBottom =
      parseFloat(style.getPropertyValue('--bungee-safe-bottom')) || 0;
    const viewport = courtViewport(w, h, safeTop, safeBottom);
    this.viewport = { ...viewport, width: w };
    this.camera.aspect = w / viewport.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setViewport(0, viewport.bottom, w, viewport.height);
  }

  destroy() {
    this.clearInput();
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    this.abort.abort();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
