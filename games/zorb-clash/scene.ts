import * as T from 'three';
import {
  BALL_RADIUS,
  GOAL_DEPTH,
  GOAL_HEIGHT,
  GOAL_WIDTH,
  PITCH_LENGTH,
  PITCH_WIDTH,
  type PlayerInput,
  type Ramp,
  type SpringCushion,
  type ZorbClashSnapshot,
} from './types';
import { createZorbAvatar, poseZorbWorker, type ZorbMeshRig } from './avatar';

type SceneCallbacks = {
  input: (inp: PlayerInput) => void;
};

export class ZorbClashScene {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera: T.PerspectiveCamera;

  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private animFrame = 0;
  private lastTime = 0;

  private zorbRigs = new Map<string, ZorbMeshRig>();
  private ballMesh: T.Mesh;
  private cushionMeshes = new Map<
    string,
    { group: T.Group; pad: T.Mesh; springs: T.Mesh[] }
  >();
  private rampMeshes: T.Group[] = [];

  // Particles
  private particles: {
    mesh: T.Mesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
  }[] = [];

  private currentInput: PlayerInput = {
    x: 0,
    z: 0,
    dash: false,
    brace: false,
    wiggle: false,
  };
  private keysDown = new Set<string>();

  constructor(
    container: HTMLElement,
    private callbacks: SceneCallbacks,
  ) {
    this.container = container;

    // Renderer
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Camera
    this.camera = new T.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.5,
      200,
    );
    this.camera.position.set(0, 32, -38);
    this.camera.lookAt(0, 0, 0);

    this.scene.background = new T.Color('#64b5f6');
    this.scene.fog = new T.FogExp2('#64b5f6', 0.008);

    this.setupLighting();
    this.setupPitch();
    this.setupGoals();

    // Create Ball Mesh
    this.ballMesh = this.createBeachBallMesh();
    this.scene.add(this.ballMesh);

    // Setup Window Resize
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    // Keyboard events
    this.setupKeyboardListeners();

    // Render loop
    this.loop(0);
  }

  private setupLighting() {
    const ambient = new T.AmbientLight('#ffffff', 1.2);
    this.scene.add(ambient);

    const sun = new T.DirectionalLight('#fff5ea', 1.8);
    sun.position.set(25, 45, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -35;
    sun.shadow.camera.right = 35;
    sun.shadow.camera.top = 35;
    sun.shadow.camera.bottom = -35;
    this.scene.add(sun);

    // Stadium Floodlights at the 4 corners
    const floodlightPositions = [
      [-PITCH_WIDTH / 2 - 4, 18, -PITCH_LENGTH / 2 - 4],
      [PITCH_WIDTH / 2 + 4, 18, -PITCH_LENGTH / 2 - 4],
      [-PITCH_WIDTH / 2 - 4, 18, PITCH_LENGTH / 2 + 4],
      [PITCH_WIDTH / 2 + 4, 18, PITCH_LENGTH / 2 + 4],
    ];

    for (const [fx, fy, fz] of floodlightPositions) {
      const poleGeo = new T.CylinderGeometry(0.2, 0.25, fy, 8);
      const poleMat = new T.MeshStandardMaterial({
        color: '#555e69',
        metalness: 0.5,
      });
      const pole = new T.Mesh(poleGeo, poleMat);
      pole.position.set(fx, fy / 2, fz);
      this.scene.add(pole);

      const light = new T.PointLight('#fff', 0.8, 45, 1.2);
      light.position.set(fx, fy, fz);
      this.scene.add(light);
    }
  }

  private setupPitch() {
    // Grass turf
    const turfGeo = new T.PlaneGeometry(PITCH_WIDTH + 8, PITCH_LENGTH + 12);
    const turfMat = new T.MeshStandardMaterial({
      color: '#38b000',
      roughness: 0.85,
    });
    const turf = new T.Mesh(turfGeo, turfMat);
    turf.rotation.x = -Math.PI / 2;
    turf.receiveShadow = true;
    this.scene.add(turf);

    // Field line markings with polygonOffset to guarantee zero Z-fighting
    const lineMat = new T.MeshBasicMaterial({
      color: '#ffffff',
      opacity: 0.9,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    // Center circle
    const centerCircleGeo = new T.RingGeometry(5.8, 6.0, 48);
    const centerCircle = new T.Mesh(centerCircleGeo, lineMat);
    centerCircle.rotation.x = -Math.PI / 2;
    centerCircle.position.y = 0.02;
    this.scene.add(centerCircle);

    // Halfway line
    const halfLineGeo = new T.PlaneGeometry(PITCH_WIDTH, 0.2);
    const halfLine = new T.Mesh(halfLineGeo, lineMat);
    halfLine.rotation.x = -Math.PI / 2;
    halfLine.position.y = 0.02;
    this.scene.add(halfLine);

    // Center Spot
    const spotGeo = new T.CircleGeometry(0.4, 24);
    const spot = new T.Mesh(spotGeo, lineMat);
    spot.rotation.x = -Math.PI / 2;
    spot.position.y = 0.02;
    this.scene.add(spot);

    // Stadium surrounding under-ground plate safely below turf (y = -0.2)
    const subGroundMat = new T.MeshStandardMaterial({
      color: '#1a1c29',
      roughness: 0.9,
    });
    const subGroundGeo = new T.PlaneGeometry(
      PITCH_WIDTH + 36,
      PITCH_LENGTH + 36,
    );
    const subGround = new T.Mesh(subGroundGeo, subGroundMat);
    subGround.rotation.x = -Math.PI / 2;
    subGround.position.y = -0.2;
    this.scene.add(subGround);

    // Stadium surrounding perimeter barrier walls
    const barrierMat = new T.MeshStandardMaterial({
      color: '#2b2d42',
      roughness: 0.5,
    });

    // West and East outer boundary walls
    const sideWallGeo = new T.BoxGeometry(1.4, 1.6, PITCH_LENGTH + 12);
    const westWall = new T.Mesh(sideWallGeo, barrierMat);
    westWall.position.set(-(PITCH_WIDTH / 2 + 3.8), 0.8, 0);
    westWall.castShadow = true;
    this.scene.add(westWall);

    const eastWall = new T.Mesh(sideWallGeo, barrierMat);
    eastWall.position.set(PITCH_WIDTH / 2 + 3.8, 0.8, 0);
    eastWall.castShadow = true;
    this.scene.add(eastWall);

    // North and South outer boundary walls flanking the goals
    const endWallWidth = (PITCH_WIDTH + 8 - GOAL_WIDTH) / 2;
    const endWallGeo = new T.BoxGeometry(endWallWidth, 1.6, 1.4);

    for (const zSign of [-1, 1]) {
      const zPos = zSign * (PITCH_LENGTH / 2 + 5.8);
      const leftEndWall = new T.Mesh(endWallGeo, barrierMat);
      leftEndWall.position.set(-(GOAL_WIDTH / 2 + endWallWidth / 2), 0.8, zPos);
      leftEndWall.castShadow = true;
      this.scene.add(leftEndWall);

      const rightEndWall = new T.Mesh(endWallGeo, barrierMat);
      rightEndWall.position.set(GOAL_WIDTH / 2 + endWallWidth / 2, 0.8, zPos);
      rightEndWall.castShadow = true;
      this.scene.add(rightEndWall);
    }
  }

  private setupGoals() {
    const postMat = new T.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.2,
      metalness: 0.1,
    });
    const netMat = new T.MeshStandardMaterial({
      color: '#ffffff',
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });

    const halfW = GOAL_WIDTH / 2;
    const goalZ = PITCH_LENGTH / 2;

    const buildGoal = (sign: number, color: string) => {
      const g = new T.Group();
      g.position.set(0, 0, sign * goalZ);

      // Color accent band on posts
      const accentMat = new T.MeshStandardMaterial({ color, roughness: 0.3 });

      // Posts
      for (const side of [-1, 1]) {
        const postGeo = new T.CylinderGeometry(0.16, 0.16, GOAL_HEIGHT, 16);
        const post = new T.Mesh(postGeo, postMat);
        post.position.set(side * halfW, GOAL_HEIGHT / 2, 0);
        post.castShadow = true;
        g.add(post);

        const bandGeo = new T.CylinderGeometry(0.17, 0.17, 0.4, 16);
        const band = new T.Mesh(bandGeo, accentMat);
        band.position.set(side * halfW, GOAL_HEIGHT - 0.3, 0);
        g.add(band);
      }

      // Crossbar
      const barGeo = new T.CylinderGeometry(0.16, 0.16, GOAL_WIDTH, 16);
      const bar = new T.Mesh(barGeo, postMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, GOAL_HEIGHT, 0);
      bar.castShadow = true;
      g.add(bar);

      // Net Box
      const netGeo = new T.BoxGeometry(GOAL_WIDTH, GOAL_HEIGHT, GOAL_DEPTH);
      const net = new T.Mesh(netGeo, netMat);
      net.position.set(0, GOAL_HEIGHT / 2, sign * (GOAL_DEPTH / 2));
      g.add(net);

      this.scene.add(g);
    };

    buildGoal(-1, '#f95738'); // Red team goal South
    buildGoal(1, '#00b4d8'); // Blue team goal North
  }

  private createBeachBallMesh(): T.Mesh {
    const geo = new T.SphereGeometry(BALL_RADIUS, 32, 24);

    // Canvas texture with beach ball panels
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const panelColors = [
      '#e63946',
      '#f1faee',
      '#457b9d',
      '#ffb703',
      '#2a9d8f',
      '#fb8500',
    ];
    const sliceWidth = canvas.width / panelColors.length;

    for (let i = 0; i < panelColors.length; i++) {
      ctx.fillStyle = panelColors[i];
      ctx.fillRect(i * sliceWidth, 0, sliceWidth, canvas.height);
    }

    // Top and bottom white caps
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 0, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height, 32, 0, Math.PI * 2);
    ctx.fill();

    const texture = new T.CanvasTexture(canvas);
    texture.wrapS = T.RepeatWrapping;

    const mat = new T.MeshStandardMaterial({
      map: texture,
      roughness: 0.25,
      metalness: 0.1,
    });

    const mesh = new T.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  syncFieldFeatures(cushions: SpringCushion[], ramps: Ramp[]) {
    // Setup Cushions
    if (this.cushionMeshes.size === 0) {
      const cushionMat = new T.MeshStandardMaterial({
        color: '#ffbe0b',
        roughness: 0.3,
        metalness: 0.1,
      });
      const springMat = new T.MeshStandardMaterial({
        color: '#8d99ae',
        metalness: 0.7,
      });

      for (const c of cushions) {
        const group = new T.Group();
        group.position.set(c.x, c.y, c.z);

        // Bumper Cushion Pad
        const padGeo = new T.BoxGeometry(c.width, c.height, c.depth);
        const pad = new T.Mesh(padGeo, cushionMat);
        pad.castShadow = true;
        group.add(pad);

        // Visual Accordion Springs
        const springs: T.Mesh[] = [];
        const springCount = Math.max(
          2,
          Math.floor(Math.max(c.width, c.depth) / 3),
        );
        for (let i = 0; i < springCount; i++) {
          const sGeo = new T.CylinderGeometry(0.18, 0.18, 0.8, 8);
          const sMesh = new T.Mesh(sGeo, springMat);
          sMesh.rotation.x = Math.PI / 2;
          sMesh.position.set((i - (springCount - 1) / 2) * 2.2, 0, 0);
          group.add(sMesh);
          springs.push(sMesh);
        }

        this.scene.add(group);
        this.cushionMeshes.set(c.id, { group, pad, springs });
      }
    }

    // Setup Ramps
    if (this.rampMeshes.length === 0) {
      const rampMat = new T.MeshStandardMaterial({
        color: '#fb8500',
        roughness: 0.4,
      });

      for (const r of ramps) {
        const g = new T.Group();
        g.position.set(r.x, r.y, r.z);
        g.rotation.y = r.rotation;

        const boxGeo = new T.BoxGeometry(r.width, r.height, r.length);
        const box = new T.Mesh(boxGeo, rampMat);
        box.rotation.x = -0.24;
        box.castShadow = true;
        box.receiveShadow = true;
        g.add(box);

        this.scene.add(g);
        this.rampMeshes.push(g);
      }
    }
  }

  emitImpactSparks(
    x: number,
    y: number,
    z: number,
    count = 18,
    color = '#ffd166',
  ) {
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
    const pGeo = new T.PlaneGeometry(0.25, 0.25);

    for (let i = 0; i < 70; i++) {
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
        vx: (Math.random() - 0.5) * 12,
        vy: 8 + Math.random() * 12,
        vz: (Math.random() - 0.5) * 12,
        life: 0,
        maxLife: 1.5 + Math.random() * 1.0,
      });
    }
  }

  render(snap: ZorbClashSnapshot) {
    const { world, selfId } = snap;
    this.syncFieldFeatures(world.cushions, world.ramps);

    // Update Ball
    this.ballMesh.position.set(world.ball.x, world.ball.y, world.ball.z);
    this.ballMesh.quaternion.set(
      world.ball.qx,
      world.ball.qy,
      world.ball.qz,
      world.ball.qw,
    );

    // Update Players
    for (const player of world.players) {
      let rig = this.zorbRigs.get(player.id);
      if (!rig) {
        rig = createZorbAvatar(player.team, player.color);
        this.scene.add(rig.root);
        this.zorbRigs.set(player.id, rig);
      }

      rig.root.position.set(player.x, player.y, player.z);
      rig.root.quaternion.set(player.qx, player.qy, player.qz, player.qw);

      const speed = Math.hypot(player.vx, player.vz);
      poseZorbWorker(rig, world.clock, {
        speed,
        turtle: player.turtle,
        braced: player.braced,
        dashCharge: player.dashCharge,
        dashing: player.dashing > 0,
      });

      // Visual Dash Pulse
      if (player.dashCharge > 0.1) {
        const pulse =
          1.0 + Math.sin(world.clock * 25) * 0.08 * player.dashCharge;
        rig.bubble.scale.set(pulse, pulse, pulse);
      } else {
        rig.bubble.scale.set(1, 1, 1);
      }
    }

    // Remove defunct player meshes
    for (const [id, rig] of this.zorbRigs.entries()) {
      if (!world.players.some((p) => p.id === id)) {
        this.scene.remove(rig.root);
        this.zorbRigs.delete(id);
      }
    }

    // Dynamic camera tracking: focus between local player and ball
    const localPlayer = world.players.find((p) => p.id === selfId);
    let targetX = world.ball.x * 0.3;
    let targetZ = world.ball.z * 0.3;
    if (localPlayer) {
      targetX = localPlayer.x * 0.7 + world.ball.x * 0.3;
      targetZ = localPlayer.z * 0.7 + world.ball.z * 0.3;
    }

    const desiredCamX = targetX * 0.5;
    const desiredCamZ = targetZ - 26;
    const desiredCamY = 25 + Math.abs(targetZ) * 0.15;

    this.camera.position.x += (desiredCamX - this.camera.position.x) * 0.08;
    this.camera.position.y += (desiredCamY - this.camera.position.y) * 0.08;
    this.camera.position.z += (desiredCamZ - this.camera.position.z) * 0.08;
    this.camera.lookAt(targetX * 0.8, 1.2, targetZ);
  }

  private setupKeyboardListeners() {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          e.code,
        )
      ) {
        e.preventDefault();
      }
      this.keysDown.add(e.code);
      this.updateInput();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keysDown.delete(e.code);
      this.updateInput();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
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
    const dt = Math.min((timeMs - this.lastTime) / 1000, 0.1);
    this.lastTime = timeMs;

    // Update particles
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
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}
