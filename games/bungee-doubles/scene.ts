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
  TEAM_COLORS,
  type BungeeAction,
  type BungeeSnapshot,
  type PlayerInput,
  type TeamId,
} from './types';
import { computeCameraRelativeMovement } from './physics';

type Callbacks = {
  input: (i: PlayerInput) => void;
  action: (a: BungeeAction) => void;
};

export class BungeeScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(46, 1, 0.1, 150);
  private renderer: T.WebGLRenderer;
  private courtGroup = tennisCourt();
  private ballMesh = tennisBall();
  private landingTarget = createLandingTarget();
  private playerMeshes = new Map<string, T.Group>();
  private bungeeCords: Record<TeamId, ReturnType<typeof createBungeeCord>>;

  private keys = new Set<string>();
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
    { name: 'Broadcast 3/4', yaw: Math.atan2(-14.2, -9.6), pitch: 0.67, dist: 21.8 },
    { name: 'Orange Baseline', yaw: -Math.PI, pitch: 0.48, dist: 20.5 },
    { name: 'Sideline View', yaw: -Math.PI / 2, pitch: 0.60, dist: 22.0 },
    { name: 'Teal Baseline', yaw: 0, pitch: 0.48, dist: 20.5 },
    { name: 'Teal Corner', yaw: 0.98, pitch: 0.67, dist: 21.8 },
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
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;

    this.container.appendChild(this.renderer.domElement);

    // Bungee cords for both teams
    this.bungeeCords = {
      orange: createBungeeCord('orange'),
      teal: createBungeeCord('teal'),
    };
    this.scene.add(this.bungeeCords.orange.group);
    this.scene.add(this.bungeeCords.teal.group);

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
    this.scene.background = new T.Color('#78b7e6'); // Vibrant Mediterranean sky
    this.scene.fog = new T.FogExp2('#8ec4ee', 0.01);

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
    const hemi = new T.HemisphereLight('#ffffff', '#334155', 0.95);
    this.scene.add(hemi);

    const sun = new T.DirectionalLight('#fffaf0', 1.55);
    sun.position.set(16, 26, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 6;
    sun.shadow.camera.far = 70;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    sun.shadow.bias = -0.0003;
    this.scene.add(sun);

    // Subtle warm court fill light over the net to make the ball and players pop
    const courtFill = new T.PointLight('#ffe8d6', 0.85, 25);
    courtFill.position.set(0, 5.5, 0);
    this.scene.add(courtFill);
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
    const confettiColors = ['#ff3366', '#ffd166', '#06d6a0', '#118ab2', '#ffffff'];
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
        if (e.target instanceof HTMLInputElement) return;
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
        } else if (e.code === 'KeyW' && e.altKey) {
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
    let downButton = 0;
    let dragStartX = 0;
    let dragStartY = 0;
    let lastX = 0;
    let lastY = 0;
    let hasDragged = false;

    dom.addEventListener(
      'pointerdown',
      (e) => {
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
        if (!isPointerDown) return;
        const totalDist = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
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
            Math.min(1.30, this.targetPitch + dy * rotSpeed),
          );
        }
      },
      { signal },
    );

    const endPointer = (e: PointerEvent) => {
      if (!isPointerDown) return;
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {}
      dom.style.cursor = 'grab';
      isPointerDown = false;

      if (!hasDragged) {
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
    dom.addEventListener('pointercancel', endPointer, { signal });

    // Scroll wheel zoom
    dom.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.targetDist = Math.max(
          12,
          Math.min(34, this.targetDist + e.deltaY * 0.015),
        );
      },
      { signal, passive: false },
    );

    dom.addEventListener(
      'contextmenu',
      (e) => e.preventDefault(),
      { signal },
    );
  }

  private pollInput(dt: number) {
    // Keyboard camera orbiting with Q and R
    if (this.keys.has('KeyQ')) {
      this.targetYaw -= 1.8 * dt;
    }
    if (this.keys.has('KeyR')) {
      this.targetYaw += 1.8 * dt;
    }

    let screenX = 0;
    let screenZ = 0;

    // A/Left Arrow is ALWAYS screen left (-1)
    // D/Right Arrow is ALWAYS screen right (+1)
    // W/Up Arrow is ALWAYS screen forward/into court (+1)
    // S/Down Arrow is ALWAYS screen backward/toward viewer (-1)
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) screenX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) screenX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) screenZ += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) screenZ -= 1;

    // Transform screen direction to world space using camera orientation matrix
    const worldMove = computeCameraRelativeMovement(
      screenX,
      screenZ,
      this.camera.matrixWorld.elements,
    );

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

    // Update ball
    this.ballMesh.position.set(world.ball.x, world.ball.y, world.ball.z);
    this.ballMesh.rotation.x += world.ball.vx * 0.15;
    this.ballMesh.rotation.z += world.ball.vz * 0.15;

    // Update landing indicator and contact shadow with clock
    this.landingTarget.update(
      world.ball.x,
      world.ball.z,
      world.ball.y,
      world.clock,
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
        this.playerMeshes.delete(id);
      }
    }

    for (const p of world.players) {
      let mesh = this.playerMeshes.get(p.id);
      if (!mesh) {
        const isLocal = p.id === snap.localId;
        const look = isLocal ? getEquippedLook() : undefined;
        mesh = tennisPlayer(TEAM_COLORS[p.team], p.team, look);
        this.scene.add(mesh);
        this.playerMeshes.set(p.id, mesh);
      }

      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y = p.facing;

      const walking = Math.hypot(p.vx, p.vz) > 0.4;
      poseTennisWorker(mesh, world.clock, {
        walking,
        specialState: p.specialState,
      });
    }

    // Update bungee cords between teammates with tension vibration and clock
    for (const team of ['orange', 'teal'] as const) {
      const teamPlayers = world.players.filter((p) => p.team === team);
      const tether = world.tethers[team];
      if (teamPlayers.length >= 2 && tether) {
        this.bungeeCords[team].group.visible = true;
        this.bungeeCords[team].update(
          [teamPlayers[0].x, teamPlayers[0].y, teamPlayers[0].z],
          [teamPlayers[1].x, teamPlayers[1].y, teamPlayers[1].z],
          tether.tension,
          world.clock,
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

    // Camera framing: smoothly follow the action across the court
    const targetCamLookX = world.ball.x * 0.28;
    const targetCamLookZ = world.ball.z * 0.35;
    this.currentCamLook.lerp(
      new T.Vector3(targetCamLookX, 1.0, targetCamLookZ),
      0.06,
    );
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
    this.currentYaw += (this.targetYaw - this.currentYaw) * 0.14;
    this.currentPitch += (this.targetPitch - this.currentPitch) * 0.14;
    this.currentDist += (this.targetDist - this.currentDist) * 0.14;

    const horizDist = this.currentDist * Math.cos(this.currentPitch);
    const camX = this.currentCamLook.x + horizDist * Math.sin(this.currentYaw);
    const camY =
      this.currentCamLook.y + this.currentDist * Math.sin(this.currentPitch);
    const camZ = this.currentCamLook.z + horizDist * Math.cos(this.currentYaw);
    this.baseCamPos.set(camX, camY, camZ);

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.set(
        camX + shakeOffsetX,
        camY + shakeOffsetY,
        camZ,
      );
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

    this.renderer.render(this.scene, this.camera);
  };

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  destroy() {
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    this.abort.abort();
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
