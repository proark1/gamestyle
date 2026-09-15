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

  // Particle pool for racket hits & bonks
  private particlePool: {
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
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

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
    this.setupInputs();

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.container);
    this.resize();

    this.animate();
  }

  private setupScene() {
    this.scene.background = new T.Color('#87ceeb'); // Sunny open sky blue
    this.scene.fog = new T.FogExp2('#87ceeb', 0.012);

    this.scene.add(this.courtGroup);
    this.scene.add(this.ballMesh);
    this.scene.add(this.landingTarget.mesh);

    // Stadium camera position (slightly elevated sideline view)
    this.camera.position.set(-15.5, 13.5, 0);
    this.camera.lookAt(0, 1.2, 0);
  }

  private setupLighting() {
    const hemi = new T.HemisphereLight('#ffffff', '#445566', 0.85);
    this.scene.add(hemi);

    const sun = new T.DirectionalLight('#fff8e7', 1.4);
    sun.position.set(18, 30, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 70;
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
  }

  private setupParticles() {
    const geo = new T.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new T.MeshBasicMaterial({ color: '#ffea00' });
    for (let i = 0; i < 40; i++) {
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

  private spawnHitPuff(pos: [number, number, number], color = '#ffea00') {
    let spawned = 0;
    for (const p of this.particlePool) {
      if (!p.active) {
        p.active = true;
        p.mesh.visible = true;
        (p.mesh.material as T.MeshBasicMaterial).color.set(color);
        p.mesh.position.set(pos[0], pos[1], pos[2]);
        p.vx = (Math.random() - 0.5) * 6;
        p.vy = Math.random() * 5 + 2;
        p.vz = (Math.random() - 0.5) * 6;
        p.life = 0;
        p.maxLife = 0.35 + Math.random() * 0.2;
        spawned++;
        if (spawned >= 8) break;
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

    // Mouse click to swing racket
    this.renderer.domElement.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button === 0) {
          this.cb.action({ type: 'swing' });
        } else if (e.button === 2) {
          this.cb.action({ type: 'smash' });
        }
      },
      { signal },
    );

    this.renderer.domElement.addEventListener(
      'contextmenu',
      (e) => e.preventDefault(),
      { signal },
    );
  }

  private pollInput() {
    let x = 0;
    let z = 0;

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z -= 1;

    const len = Math.hypot(x, z);
    if (len > 0) {
      x /= len;
      z /= len;
    }

    const nextInput: PlayerInput = {
      x,
      z,
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

    // Update landing indicator
    this.landingTarget.update(world.ball.x, world.ball.z, world.ball.y);

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

    // Update bungee cords between teammates
    for (const team of ['orange', 'teal'] as const) {
      const teamPlayers = world.players.filter((p) => p.team === team);
      const tether = world.tethers[team];
      if (teamPlayers.length >= 2 && tether) {
        this.bungeeCords[team].group.visible = true;
        this.bungeeCords[team].update(
          [teamPlayers[0].x, teamPlayers[0].y, teamPlayers[0].z],
          [teamPlayers[1].x, teamPlayers[1].y, teamPlayers[1].z],
          tether.tension,
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
        if (event.pos) this.spawnHitPuff(event.pos, '#ff3300');
      } else if (event.type === 'partner_bonk') {
        this.triggerScreenShake(0.06, 0.1); // Small tactile bonk
        if (event.pos) this.spawnHitPuff(event.pos, '#ffcc00');
      } else if (event.type === 'wall_rebound') {
        if (event.pos) this.spawnHitPuff(event.pos, '#90e0ef'); // Cyan-glass sparkle
      } else if (event.type === 'racket_hit') {
        if (event.pos) this.spawnHitPuff(event.pos, '#ffff00');
      }
    }

    // Camera framing: smoothly follow the action between ball and court center
    const targetCamLookX = world.ball.x * 0.35;
    const targetCamLookZ = world.ball.z * 0.45;
    this.camera.lookAt(targetCamLookX, 1.2, targetCamLookZ);
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

    this.pollInput();

    // Subtle screen shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.x = -15.5 + shakeOffsetX;
      this.camera.position.y = 13.5 + shakeOffsetY;
    } else {
      this.camera.position.set(-15.5, 13.5, 0);
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
