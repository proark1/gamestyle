import * as T from 'three';
import { getEquippedLook } from '../../shared/wardrobe/wardrobe-state';
import { basketballBall, basketballCourt, basketballPlayer } from './models';
import { poseBasketballWorker } from './avatar';
import {
  HOOP,
  idleInput,
  TEAM_COLORS,
  type BasketballAction,
  type BasketballSnapshot,
  type Player,
  type PlayerInput,
} from './types';

type Callbacks = {
  input: (i: PlayerInput) => void;
  action: (a: BasketballAction) => void;
};

export class BasketballScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(48, 1, 0.1, 150);
  private renderer: T.WebGLRenderer;
  private courtGroup = basketballCourt();
  private ballMesh = basketballBall();
  private playerMeshes = new Map<string, T.Group>();
  private ring: T.Mesh;
  private trajectoryPoints: T.Mesh[] = [];

  private keys = new Set<string>();
  private abort = new AbortController();
  private observer: ResizeObserver;
  private frameId = 0;
  private lastTime = 0;
  private localId = '';
  private currentInput: PlayerInput = idleInput();
  private lastSpacePress = 0;
  private isSpaceHeld = false;
  private cameraMode: 'iso' | 'follow' = 'iso';

  constructor(
    private container: HTMLDivElement,
    private cb: Callbacks,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

    this.renderer.domElement.setAttribute(
      'aria-label',
      'Court Clash basketball arena. WASD moves, Space shoots/dunks, E passes/steals, Shift sprints, V switches camera.',
    );
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);

    // Stack or Sink style palette: pastel turquoise sky & warm sunlight
    this.scene.background = new T.Color('#b5d4ca');
    this.scene.fog = new T.Fog('#b5d4ca', 35, 85);

    this.scene.add(new T.HemisphereLight('#fff2d4', '#7fa497', 2.8));
    const sun = new T.DirectionalLight('#fff1d2', 3.2);
    sun.position.set(-10, 24, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -18,
      right: 18,
      top: 18,
      bottom: -18,
    });
    sun.shadow.normalBias = 0.05;
    this.scene.add(sun);

    // Court & Ball
    this.scene.add(this.courtGroup);
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

  private updateCameraPosition(player?: Player) {
    if (this.cameraMode === 'follow' && player) {
      this.camera.position.set(player.x * 0.7, player.y + 6.5, player.z + 9.5);
      this.camera.lookAt(player.x * 0.5, 2.0, HOOP.z * 0.6);
    } else {
      // Classic Stack or Sink isometric perspective
      this.camera.position.set(0, 15.5, 14.5);
      this.camera.lookAt(0, 1.8, -3.8);
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
      // Check for Super Jump double-tap
      if (now - this.lastSpacePress < 320) {
        this.cb.action({ type: 'superJump' });
      }
      this.lastSpacePress = now;
      this.isSpaceHeld = true;
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
      seq: this.currentInput.seq + 1,
    };

    this.cb.input(this.currentInput);
  }

  render(snap: BasketballSnapshot) {
    this.localId = snap.localId;
    const world = snap.world;
    const now = world.clock;

    // 1. Render ball
    this.ballMesh.position.set(world.ball.x, world.ball.y, world.ball.z);
    if (!world.ball.heldBy) {
      this.ballMesh.rotation.x += world.ball.vx * 0.05;
      this.ballMesh.rotation.z += world.ball.vz * 0.05;
    }

    // 2. Render players
    const activeIds = new Set<string>();
    let localPlayer: Player | undefined;

    for (const p of world.players) {
      activeIds.add(p.id);
      if (p.id === this.localId) localPlayer = p;

      let mesh = this.playerMeshes.get(p.id);
      if (!mesh) {
        const look = p.bot ? undefined : getEquippedLook();
        mesh = basketballPlayer(TEAM_COLORS[p.team], p.team, look);
        this.playerMeshes.set(p.id, mesh);
        this.scene.add(mesh);
      }

      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y = p.facing;

      const moving = Math.hypot(p.vx, p.vz) > 0.4;
      const dunking =
        !p.grounded &&
        p.hasBall &&
        Math.hypot(p.x - HOOP.x, p.z - HOOP.z) < 3.5;
      const shooting = p.chargingShot || (!p.grounded && p.hasBall);

      poseBasketballWorker(mesh, now * 0.001, {
        moving,
        shooting,
        dunking,
        dribbling: p.hasBall && !shooting && !dunking,
        color: p.color,
        still: !moving && !shooting && !dunking && !p.hasBall,
      });
    }

    // Remove obsolete player meshes
    for (const [id, mesh] of this.playerMeshes) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.playerMeshes.delete(id);
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

  private renderLoop = (_time: number) => {
    this.frameId = requestAnimationFrame(this.renderLoop);
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
