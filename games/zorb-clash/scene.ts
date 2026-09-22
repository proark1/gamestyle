import { shouldRenderFrame } from '../../shared/rendering/runtime';
import { disposeObject } from '../../shared/rendering/dispose-object';
import * as T from 'three';
import {
  BALL_RADIUS,
  type PlayerInput,
  type Ramp,
  type SpringCushion,
  type ZorbClashSnapshot,
} from './types';
import { createZorbAvatar, poseZorbWorker, type ZorbMeshRig } from './avatar';
import { getEquippedLook } from '../../shared/wardrobe/wardrobe-state';
import { cameraTarget } from './controls';
import { FENCE_HEIGHT } from './physics';
import { createStadium, type StadiumRig } from './stadium';
import { createRenderer } from '../../shared/rendering/create-renderer';
import {
  addHouseLight,
  HOUSE_EXPOSURE,
  SKY,
} from '../../shared/rendering/house-light';

type SceneCallbacks = {
  input: (inp: PlayerInput) => void;
};

/** Visual comic pop-up sprite ("BONK!", "SLAM!", "BOING!") */
type ComicPopup = {
  mesh: T.Mesh;
  vy: number;
  rotSpeed: number;
  life: number;
  maxLife: number;
};

/** Visual expanding ground shockwave ring */
type ShockwaveRing = {
  mesh: T.Mesh;
  maxRadius: number;
  life: number;
  maxLife: number;
};

export class ZorbClashScene {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera: T.PerspectiveCamera;

  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private animFrame = 0;
  private lastTime = 0;

  private stadium: StadiumRig;
  private zorbRigs = new Map<string, ZorbMeshRig>();
  private ballMesh: T.Mesh;
  private ballShadow: T.Mesh;

  private cushionMeshes = new Map<
    string,
    {
      group: T.Group;
      pad: T.Mesh;
      springs: T.Mesh[];
      baseZ: number;
      baseX: number;
    }
  >();
  private rampMeshes: T.Group[] = [];

  // Particles & Visual FX
  private particles: {
    mesh: T.Mesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
  }[] = [];

  private comicPopups: ComicPopup[] = [];
  private shockwaves: ShockwaveRing[] = [];
  private screenShake = 0;
  private celebrationActive = false;

  private currentInput: PlayerInput = {
    x: 0,
    z: 0,
    dash: false,
    brace: false,
    wiggle: false,
  };
  private keysDown = new Set<string>();
  private inputEnabled = true;
  private inputCleanup: (() => void) | undefined;
  private renderClock = 0;

  constructor(
    container: HTMLElement,
    private callbacks: SceneCallbacks,
  ) {
    this.container = container;

    this.renderer = createRenderer(container, {
      exposure: HOUSE_EXPOSURE,
      focusable: false,
    }).renderer;
    this.renderer.setSize(container.clientWidth, container.clientHeight);

    // Camera
    this.camera = new T.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.5,
      200,
    );
    this.camera.position.set(0, 32, -38);
    this.camera.lookAt(0, 0, 0);

    this.setupLighting();

    // 3D Stadium Environment (striped turf, bleachers, floodlights, goals, sponsor dasher boards)
    this.stadium = createStadium();
    this.scene.add(this.stadium.root);

    // Create High-Gloss Beach Ball Mesh
    this.ballMesh = this.createBeachBallMesh();
    this.scene.add(this.ballMesh);

    // Soft Drop Shadow beneath Beach Ball
    const shadowGeo = new T.CircleGeometry(BALL_RADIUS * 1.15, 24);
    const shadowMat = new T.MeshBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    this.ballShadow = new T.Mesh(shadowGeo, shadowMat);
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.02;
    this.scene.add(this.ballShadow);

    // Setup Window Resize
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    // Keyboard events
    this.setupKeyboardListeners();

    // Render loop
    this.loop(0);
  }

  private setupLighting() {
    const { sun } = addHouseLight(this.scene, {
      sky: SKY.coast,
      fog: { near: 45, far: 115 },
    });
    sun.position.set(-18, 38, -24);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 130;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.normalBias = 0.04;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
  }

  private createBeachBallMesh(): T.Mesh {
    const geo = new T.SphereGeometry(BALL_RADIUS, 32, 24);

    // Canvas texture with high-contrast rainbow beach ball panels
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const panelColors = [
      '#e63946',
      '#ffffff',
      '#00b4d8',
      '#ffd166',
      '#06d6a0',
      '#ff006e',
    ];
    const sliceWidth = canvas.width / panelColors.length;

    for (let i = 0; i < panelColors.length; i++) {
      ctx.fillStyle = panelColors[i];
      ctx.fillRect(i * sliceWidth, 0, sliceWidth, canvas.height);

      // Subtle seam divider shading
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(i * sliceWidth + sliceWidth - 4, 0, 4, canvas.height);
    }

    // Top and bottom white circular caps
    for (const capY of [0, canvas.height]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, capY, 48, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    const texture = new T.CanvasTexture(canvas);
    texture.wrapS = T.RepeatWrapping;

    const mat = new T.MeshPhysicalMaterial({
      map: texture,
      roughness: 0.12,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.75,
    });

    const mesh = new T.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  syncFieldFeatures(cushions: SpringCushion[], ramps: Ramp[]) {
    // Setup Cushions
    if (this.cushionMeshes.size === 0) {
      const padMat = new T.MeshStandardMaterial({
        color: '#ffbe0b',
        roughness: 0.25,
        metalness: 0.1,
      });
      const springMat = new T.MeshStandardMaterial({
        color: '#94a3b8',
        metalness: 0.75,
        roughness: 0.2,
      });
      const frameMat = new T.MeshStandardMaterial({
        color: '#2b2d42',
        metalness: 0.5,
        roughness: 0.4,
      });

      for (const c of cushions) {
        const group = new T.Group();
        group.position.set(c.x, c.y, c.z);

        // Heavy Backplate
        const isEastWest = c.side === 'west' || c.side === 'east';
        const frameGeo = new T.BoxGeometry(
          isEastWest ? 0.2 : c.width * 1.05,
          c.height * 1.05,
          isEastWest ? c.depth * 1.05 : 0.2,
        );
        const frame = new T.Mesh(frameGeo, frameMat);
        frame.castShadow = true;
        group.add(frame);

        // Bumper Cushion Pad
        const padGeo = new T.BoxGeometry(c.width, c.height, c.depth);
        const pad = new T.Mesh(padGeo, padMat);
        pad.castShadow = true;
        pad.receiveShadow = true;
        group.add(pad);

        // The visible mesh matches the physical catch fence above the padded boards.
        const fence = new T.Mesh(
          new T.BoxGeometry(
            c.width,
            FENCE_HEIGHT - 1.9,
            c.depth,
            isEastWest ? 1 : Math.ceil(c.width),
            6,
            isEastWest ? Math.ceil(c.depth) : 1,
          ),
          new T.MeshBasicMaterial({
            color: '#46685d',
            wireframe: true,
            transparent: true,
            opacity: 0.16,
          }),
        );
        fence.position.y = (FENCE_HEIGHT + 1.9) / 2 - c.y;
        group.add(fence);

        // Accordion Springs
        const springs: T.Mesh[] = [];
        const springCount = Math.max(
          2,
          Math.floor(Math.max(c.width, c.depth) / 2.8),
        );
        for (let i = 0; i < springCount; i++) {
          const sGeo = new T.CylinderGeometry(0.18, 0.18, 0.8, 10);
          const sMesh = new T.Mesh(sGeo, springMat);
          sMesh.rotation.x = Math.PI / 2;
          const offset = (i - (springCount - 1) / 2) * 2.2;
          if (isEastWest) {
            sMesh.position.set(0, 0, offset);
          } else {
            sMesh.position.set(offset, 0, 0);
          }
          group.add(sMesh);
          springs.push(sMesh);
        }

        this.scene.add(group);
        this.cushionMeshes.set(c.id, {
          group,
          pad,
          springs,
          baseZ: c.z,
          baseX: c.x,
        });
      }
    }

    // Setup Ramps
    if (this.rampMeshes.length === 0) {
      const rampMat = new T.MeshStandardMaterial({
        color: '#fb8500',
        roughness: 0.35,
        metalness: 0.2,
      });
      const railMat = new T.MeshStandardMaterial({
        color: '#ffbe0b',
        roughness: 0.3,
      });

      for (const r of ramps) {
        const g = new T.Group();
        g.position.set(r.x, r.y, r.z);
        g.rotation.y = r.rotation;

        // Ramp incline body
        const boxGeo = new T.BoxGeometry(r.width, r.height, r.length);
        const box = new T.Mesh(boxGeo, rampMat);
        box.rotation.x = -0.24;
        box.castShadow = true;
        box.receiveShadow = true;
        g.add(box);

        // Side safety railing
        for (const side of [-1, 1]) {
          const railGeo = new T.BoxGeometry(0.14, 0.45, r.length * 1.02);
          const rail = new T.Mesh(railGeo, railMat);
          rail.rotation.x = -0.24;
          rail.position.set(side * (r.width / 2 + 0.08), 0.28, 0);
          rail.castShadow = true;
          g.add(rail);
        }

        this.scene.add(g);
        this.rampMeshes.push(g);
      }
    }
  }

  /** Creates a comic pop-up billboard ("BONK!", "SLAM!", "BOING!") */
  private createComicPopup(text: string, color: string): T.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Comic starburst explosion background
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    const spikes = 12;
    const outerR = 58;
    const innerR = 36;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / spikes;
      if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1e2430';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Bold comic text
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1e2430';
    ctx.lineWidth = 6;
    ctx.font = '900 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
    ctx.restore();

    const tex = new T.CanvasTexture(canvas);
    const planeGeo = new T.PlaneGeometry(2.4, 1.2);
    const planeMat = new T.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: T.DoubleSide,
      depthTest: false,
    });
    const mesh = new T.Mesh(planeGeo, planeMat);
    mesh.renderOrder = 1000;
    return mesh;
  }

  emitComicBurst(x: number, y: number, z: number, intensity: number) {
    const words = ['BONK! 💥', 'SLAM! ⚡', 'BOING! 🌀', 'CRUNCH! 🥊'];
    const colors = ['#ff0054', '#ffb703', '#00b4d8', '#7209b7'];
    const word = words[Math.floor(Math.random() * words.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const mesh = this.createComicPopup(word, color);
    mesh.position.set(x, y + 1.2, z);
    this.scene.add(mesh);

    this.comicPopups.push({
      mesh,
      vy: 2.8 + intensity * 2.0,
      rotSpeed: (Math.random() - 0.5) * 2.0,
      life: 0,
      maxLife: 0.65,
    });
  }

  emitShockwave(
    x: number,
    y: number,
    z: number,
    maxRadius = 3.2,
    color = '#ffd166',
  ) {
    const ringGeo = new T.RingGeometry(0.3, 0.55, 32);
    const ringMat = new T.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      side: T.DoubleSide,
      depthWrite: false,
    });
    const mesh = new T.Mesh(ringGeo, ringMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.04, z);
    this.scene.add(mesh);

    this.shockwaves.push({
      mesh,
      maxRadius,
      life: 0,
      maxLife: 0.38,
    });
  }

  emitImpactSparks(
    x: number,
    y: number,
    z: number,
    count = 18,
    color = '#ffd166',
  ) {
    // Trigger Screen Shake proportional to impact intensity
    const intensity = Math.min(1.0, count / 25);
    this.screenShake = Math.min(1.0, this.screenShake + intensity * 0.75);

    // Trigger expanding ground shockwave ring
    this.emitShockwave(x, y, z, 2.5 + intensity * 1.5, color);

    // If hard impact, trigger comic popup text!
    if (intensity > 0.45) {
      this.emitComicBurst(x, y, z, intensity);
    }

    // Spark Particles
    const pGeo = new T.SphereGeometry(0.12, 6, 6);
    const pMat = new T.MeshBasicMaterial({ color });

    for (let i = 0; i < count; i++) {
      const mesh = new T.Mesh(pGeo, pMat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 2 + Math.random() * 6,
        vz: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
      });
    }
  }

  emitConfetti(x: number, y: number, z: number) {
    const colors = [
      '#ff0054',
      '#9e0059',
      '#ff5400',
      '#ffbd00',
      '#00f5d4',
      '#7b2cbf',
    ];
    const pGeo = new T.PlaneGeometry(0.28, 0.28);

    for (let i = 0; i < 75; i++) {
      const pMat = new T.MeshBasicMaterial({
        color: colors[i % colors.length],
        side: T.DoubleSide,
      });
      const mesh = new T.Mesh(pGeo, pMat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 4,
        y,
        z + (Math.random() - 0.5) * 4,
      );
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 14,
        vy: 8 + Math.random() * 14,
        vz: (Math.random() - 0.5) * 14,
        life: 0,
        maxLife: 1.5 + Math.random() * 1.0,
      });
    }
  }

  render(snap: ZorbClashSnapshot) {
    const { world, selfId } = snap;
    this.celebrationActive = world.status === 'goal_scored';
    this.syncFieldFeatures(world.cushions, world.ramps);

    // Update Ball
    this.ballMesh.position.set(world.ball.x, world.ball.y, world.ball.z);
    this.ballMesh.quaternion.set(
      world.ball.qx,
      world.ball.qy,
      world.ball.qz,
      world.ball.qw,
    );

    // Update Soft Ball Drop Shadow
    this.ballShadow.position.x = world.ball.x;
    this.ballShadow.position.z = world.ball.z;
    const ballAir = Math.max(0, world.ball.y - BALL_RADIUS);
    const shadowScale = Math.max(0.3, 1 - ballAir * 0.12);
    this.ballShadow.scale.set(shadowScale, shadowScale, shadowScale);
    (this.ballShadow.material as T.MeshBasicMaterial).opacity = Math.max(
      0.08,
      0.42 - ballAir * 0.08,
    );

    // Update Players
    for (const player of world.players) {
      let rig = this.zorbRigs.get(player.id);
      if (!rig) {
        const isLocal = player.id === selfId;
        rig = createZorbAvatar(
          player.team,
          player.color,
          isLocal ? getEquippedLook() : undefined,
          player.name,
          isLocal,
        );
        this.scene.add(rig.root);
        this.zorbRigs.set(player.id, rig);
      }

      rig.root.position.set(player.x, player.y, player.z);
      rig.root.quaternion.identity();
      rig.shell.quaternion.set(player.qx, player.qy, player.qz, player.qw);
      if (rig.shadow) rig.shadow.position.y = 0.025 - player.y;

      // Keep overhead name badge and indicator facing the camera
      if (rig.overheadIndicator) {
        rig.overheadIndicator.quaternion.copy(this.camera.quaternion);
      }

      const speed =
        player.grounded && Math.hypot(player.input.x, player.input.z) > 0.1
          ? Math.hypot(player.vx, player.vz)
          : 0;
      poseZorbWorker(rig, world.clock / 1000, {
        speed,
        turtle: player.turtle,
        braced: player.braced,
        dashCharge: player.dashCharge,
        dashing: player.dashing > 0,
        heading: player.heading,
        gait: player.gait,
        balance: player.balance,
        recovery: player.recovery,
        fallX: player.fallX,
        fallZ: player.fallZ,
      });
    }

    // Remove defunct player meshes
    for (const [id, rig] of this.zorbRigs.entries()) {
      if (!world.players.some((p) => p.id === id)) {
        this.scene.remove(rig.root);
        this.zorbRigs.delete(id);
      }
    }

    const localPlayer = world.players.find((p) => p.id === selfId);
    const target = cameraTarget(localPlayer, world.ball, this.camera.aspect);
    const dt = this.renderClock
      ? Math.max(0, Math.min(0.1, (world.clock - this.renderClock) / 1000))
      : 1;
    this.renderClock = world.clock;
    const blend = 1 - Math.exp(-5 * dt);
    this.camera.position.lerp(
      new T.Vector3(target.x, target.height, target.z - target.height),
      blend,
    );
    this.camera.lookAt(target.x, 1.2, target.z);
  }

  clearInput() {
    this.keysDown.clear();
    this.currentInput = {
      x: 0,
      z: 0,
      dash: false,
      brace: false,
      wiggle: false,
    };
    this.callbacks.input(this.currentInput);
  }

  setInputEnabled(enabled: boolean) {
    if (this.inputEnabled === enabled) return;
    this.inputEnabled = enabled;
    this.clearInput();
  }

  private setupKeyboardListeners() {
    const gameKeys = new Set([
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Space',
      'ShiftLeft',
      'ShiftRight',
    ]);
    const onKeyDown = (e: KeyboardEvent) => {
      if (!this.inputEnabled || !gameKeys.has(e.code)) return;
      if (
        e.target instanceof Element &&
        e.target.closest(
          'input, textarea, select, button, a, [contenteditable="true"], [role="dialog"]',
        )
      )
        return;
      e.preventDefault();
      this.keysDown.add(e.code);
      this.updateInput();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!this.keysDown.delete(e.code)) return;
      this.updateInput();
    };
    const clear = () => this.clearInput();
    const visibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    this.inputCleanup = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
    };
  }

  private updateInput() {
    let x = 0;
    let z = 0;

    // Screen-relative mapping: from camera facing +Z:
    // Screen-left is world +X (A / ArrowLeft)
    // Screen-right is world -X (D / ArrowRight)
    // Screen-forward is world +Z (W / ArrowUp)
    // Screen-back is world -Z (S / ArrowDown)
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) x += 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) x -= 1;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) z += 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) z -= 1;

    // Normalize diagonal input
    if (x !== 0 && z !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      z *= inv;
    }

    const dash = this.keysDown.has('Space');
    const brace =
      this.keysDown.has('ShiftLeft') || this.keysDown.has('ShiftRight');

    this.currentInput = { x, z, dash, brace, wiggle: false };
    this.callbacks.input(this.currentInput);
  }

  setTouchInput(input: PlayerInput) {
    this.currentInput = input;
    this.callbacks.input(input);
  }

  private loop = (timeMs: number) => {
    this.animFrame = requestAnimationFrame(this.loop);
    if (!shouldRenderFrame(this.renderer)) return;
    const dt = Math.min((timeMs - this.lastTime) / 1000, 0.1);
    this.lastTime = timeMs;

    // 1. Update Stadium (animated cheering spectators)
    this.stadium.update(timeMs / 1000, this.celebrationActive);

    // 2. Camera Screen Shake
    if (this.screenShake > 0.001) {
      const trauma = this.screenShake ** 2;
      this.camera.position.x += (Math.random() - 0.5) * 0.25 * trauma;
      this.camera.position.y += (Math.random() - 0.5) * 0.25 * trauma;
      this.screenShake = Math.max(0, this.screenShake - dt * 2.8);
    }

    // 3. Update Expanding Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life += dt;
      if (sw.life >= sw.maxLife) {
        this.scene.remove(sw.mesh);
        this.shockwaves.splice(i, 1);
      } else {
        const progress = sw.life / sw.maxLife;
        const radiusScale = 1 + progress * (sw.maxRadius / 0.55 - 1);
        sw.mesh.scale.set(radiusScale, radiusScale, 1);
        (sw.mesh.material as T.MeshBasicMaterial).opacity =
          0.85 * (1 - progress);
      }
    }

    // 4. Update Comic Popups ("BONK!", "SLAM!")
    for (let i = this.comicPopups.length - 1; i >= 0; i--) {
      const cp = this.comicPopups[i];
      cp.life += dt;
      if (cp.life >= cp.maxLife) {
        this.scene.remove(cp.mesh);
        this.comicPopups.splice(i, 1);
      } else {
        cp.mesh.position.y += cp.vy * dt;
        cp.mesh.rotation.z += cp.rotSpeed * dt;
        cp.mesh.quaternion.copy(this.camera.quaternion);

        const progress = cp.life / cp.maxLife;
        const popScale = Math.sin(progress * Math.PI) * 1.2;
        cp.mesh.scale.set(popScale, popScale, 1);
      }
    }

    // 5. Update Sparks & Confetti Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      } else {
        p.vy -= 16 * dt; // gravity
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.scale.setScalar(1 - p.life / p.maxLife);
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  private handleResize() {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  destroy() {
    cancelAnimationFrame(this.animFrame);
    this.resizeObserver.disconnect();
    disposeObject(this.scene);
    this.inputCleanup?.();
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
