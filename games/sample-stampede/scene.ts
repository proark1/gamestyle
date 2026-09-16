import * as THREE from 'three';
import {
  createAisleSign,
  createExitGauntlet,
  createItemMesh,
  createPalletRack,
  createPaperPlateHazard,
  createSampleKiosk,
  createShoppingCart,
  createWarehouseLightFixture,
  type CartMeshRig,
  WAREHOUSE_COLORS,
} from './models';
import { createShopperWorker, poseShopper } from './avatar';
import {
  type ItemKind,
  type PlayerInput,
  type SampleStampedeSnapshot,
} from './types';
import { WAREHOUSE_BOUNDS } from './physics';

type SceneCallbacks = {
  input: (inp: PlayerInput) => void;
};

type Particle = {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
};

type ComicPopup = {
  mesh: THREE.Mesh;
  vy: number;
  rotSpeed: number;
  life: number;
  maxLife: number;
};

type SkidMark = {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
};

export class SampleStampedeScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;

  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private animFrame = 0;
  private lastTime = 0;

  private cartRigs = new Map<string, CartMeshRig>();
  private driverMeshes = new Map<string, THREE.Group>();
  private riderMeshes = new Map<string, THREE.Group>();
  private groundItemMeshes = new Map<string, THREE.Group>();
  private hazardMeshes = new Map<string, THREE.Group>();
  private npcMeshes = new Map<string, THREE.Group>();
  private kioskMeshes = new Map<string, THREE.Group>();

  private particles: Particle[] = [];
  private comicPopups: ComicPopup[] = [];
  private skidMarks: SkidMark[] = [];
  private screenShake = 0;
  private activeSteamSources: { x: number; y: number; z: number }[] = [];

  private currentInput: PlayerInput = {
    x: 0,
    z: 0,
    steer: 0,
    throttle: 0,
    drift: false,
    grabberAction: false,
  };
  private keysDown = new Set<string>();

  constructor(
    container: HTMLElement,
    private callbacks: SceneCallbacks,
  ) {
    this.container = container;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / container.clientHeight,
      0.5,
      250,
    );
    this.camera.position.set(0, 16, 22);

    // Scene & Warehouse Ambience
    this.scene.background = new THREE.Color(0x1a252f);
    this.scene.fog = new THREE.FogExp2(0x1a252f, 0.012);

    this.setupLighting();
    this.setupWarehouseFloorAndRacks();

    // Input listeners
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    // Resize handling
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.lastTime = performance.now();
  }

  private setupLighting() {
    // Soft warehouse ambient light
    const amb = new THREE.AmbientLight(0xffffff, 0.95);
    this.scene.add(amb);

    // Main overhead high-bay industrial floodlight with shadows
    const sun = new THREE.DirectionalLight(0xfff7ed, 1.8);
    sun.position.set(15, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 70;
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);

    // Secondary soft fill light from opposite corner
    const fill = new THREE.DirectionalLight(0x74b9ff, 0.75);
    fill.position.set(-15, 20, -15);
    this.scene.add(fill);
  }

  private setupWarehouseFloorAndRacks() {
    // 1. Polished Concrete Ground
    const floorGeo = new THREE.PlaneGeometry(70, 90);
    const floorMat = new THREE.MeshStandardMaterial({
      color: WAREHOUSE_COLORS.concrete,
      roughness: 0.35,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Yellow safety striping around aisles and checkout
    const stripeGeo = new THREE.PlaneGeometry(0.3, 72);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: WAREHOUSE_COLORS.safetyYellow,
      roughness: 0.4,
    });
    for (const x of [-21, -12, -3, 6, 15, 24]) {
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.005, -2);
      stripe.receiveShadow = true;
      this.scene.add(stripe);
    }

    // Outer Warehouse Corrugated Walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      roughness: 0.8,
    });
    const northWall = new THREE.Mesh(new THREE.BoxGeometry(60, 10, 1), wallMat);
    northWall.position.set(0, 5, WAREHOUSE_BOUNDS.minZ);
    this.scene.add(northWall);

    const southWall = new THREE.Mesh(new THREE.BoxGeometry(60, 10, 1), wallMat);
    southWall.position.set(0, 5, WAREHOUSE_BOUNDS.maxZ);
    this.scene.add(southWall);

    const westWall = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 72), wallMat);
    westWall.position.set(WAREHOUSE_BOUNDS.minX, 5, 0);
    this.scene.add(westWall);

    const eastWall = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 72), wallMat);
    eastWall.position.set(WAREHOUSE_BOUNDS.maxX, 5, 0);
    this.scene.add(eastWall);

    // Pallet Shelving Racks & Hanging Signs for Aisles 1 to 5
    const aisleTitles = [
      'Bulk Paper Goods',
      'Snack & Cereal Mountain',
      'Pet Monster Kibble',
      'Mega Beverages',
      'Mystery Mega Deals',
    ];

    const aisleX = [-18, -9, 0, 9, 18];
    aisleX.forEach((ax, idx) => {
      // North Shelf
      const rackN = createPalletRack(3.2, 4.8, 16.0);
      rackN.position.set(ax, 0, -12);
      this.scene.add(rackN);

      // South Shelf
      const rackS = createPalletRack(3.2, 4.8, 16.0);
      rackS.position.set(ax, 0, 10);
      this.scene.add(rackS);

      // Hanging Aisle Sign suspended above the aisle
      const sign = createAisleSign(idx + 1, aisleTitles[idx]);
      sign.position.set(ax, 5.2, 0);
      this.scene.add(sign);
    });

    // Exit Receipt Gauntlet Booth
    const gauntlet = createExitGauntlet();
    gauntlet.position.set(0, 0, 28);
    this.scene.add(gauntlet);

    // High-bay pendant warehouse lamps
    const lightPositions: [number, number][] = [
      [-14, -12],
      [0, -12],
      [14, -12],
      [-14, 0],
      [0, 0],
      [14, 0],
      [-14, 12],
      [0, 12],
      [14, 12],
      [0, 26],
    ];
    for (const [lx, lz] of lightPositions) {
      const fixture = createWarehouseLightFixture();
      fixture.position.set(lx, 7.6, lz);
      this.scene.add(fixture);
    }

    // Overhead dark steel roof girders
    const girderMat = new THREE.MeshStandardMaterial({
      color: 0x1e272e,
      roughness: 0.9,
    });
    for (const gz of [-18, -2, 14, 28]) {
      const girder = new THREE.Mesh(
        new THREE.BoxGeometry(62, 0.4, 0.4),
        girderMat,
      );
      girder.position.set(0, 8.8, gz);
      this.scene.add(girder);
    }
  }

  public render(snapshot: SampleStampedeSnapshot) {
    const { world, localCartId } = snapshot;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // 1. Sync Carts
    for (const cart of world.carts) {
      let rig = this.cartRigs.get(cart.id);
      if (!rig) {
        rig = createShoppingCart(cart.team);
        this.scene.add(rig.root);
        this.cartRigs.set(cart.id, rig);

        // Add Driver Avatar
        const driver = createShopperWorker(cart.team === 'red' ? 0 : 1);
        driver.rotation.y = Math.PI / 2; // Face forward (+X) toward cart handle!
        rig.driverAnchor.add(driver);
        this.driverMeshes.set(cart.id, driver);

        // Add Basket Rider Avatar
        const rider = createShopperWorker(cart.team === 'red' ? 2 : 3);
        rider.rotation.y = Math.PI / 2; // Face forward (+X) inside the basket!
        rig.riderAnchor.add(rider);
        this.riderMeshes.set(cart.id, rider);
      }

      // Position & Yaw
      rig.root.position.set(cart.x, cart.y, cart.z);
      rig.root.rotation.y = cart.rotY;

      // Squeaky Wheel Wobble: Front-left wheel shakes violently!
      const wobbleAngle =
        Math.sin(cart.wobblePhase) * 0.45 * cart.wobbleIntensity;
      rig.wobblyWheel.rotation.y = wobbleAngle + 0.2; // Crooked angle
      rig.wobblyWheel.rotation.z = cart.wobblePhase * 0.5;

      // Smooth wheels rolling
      const rollSpeed = Math.sqrt(cart.vx * cart.vx + cart.vz * cart.vz);
      rig.rightFrontWheel.rotation.z += rollSpeed * dt * 4;
      rig.rearWheels.forEach((rw) => (rw.rotation.z += rollSpeed * dt * 4));

      // Grabber Pole extension & angle
      rig.grabberAssembly.rotation.y = cart.grabberAngle || 0;
      rig.grabberAssembly.scale.x = 1.0 + cart.grabberReach * 0.85;

      // Articulated grabber claw pinch animation
      if (rig.grabberJawLeft && rig.grabberJawRight) {
        const pinch = cart.grabberSwatting ? 0.48 : 0;
        rig.grabberJawLeft.rotation.y = pinch;
        rig.grabberJawRight.rotation.y = -pinch;
      }

      // Dynamic centrifugal basket lean
      const lateralImpulse =
        cart.vx * Math.sin(cart.rotY) + cart.vz * Math.cos(cart.rotY);
      rig.basket.rotation.z = Math.max(
        -0.14,
        Math.min(0.14, lateralImpulse * 0.04),
      );

      // Animate Driver Avatar
      const driver = this.driverMeshes.get(cart.id);
      if (driver) {
        poseShopper(driver, world.clock / 1000, {
          role: 'driver',
          moving: rollSpeed > 0.4,
          swatting: false,
          slipping: cart.slipSpinTimer > 0,
        });
      }

      // Animate Rider Avatar
      const rider = this.riderMeshes.get(cart.id);
      if (rider) {
        poseShopper(rider, world.clock / 1000, {
          role: 'grabber',
          moving: false,
          swatting: cart.grabberSwatting,
          slipping: cart.slipSpinTimer > 0,
        });
      }

      // Rebuild basket items inside the cart
      this.syncBasketItems(rig.basket, cart.items);

      // Emit drift sparks when skidding hard
      if (cart.driftSlip > 1.2 && Math.random() < 0.6) {
        this.emitSparks(cart.x, 0.15, cart.z, 4);
      }

      // Spawn rubber skid marks on floor when skidding or spinning
      if (
        (cart.driftSlip > 1.25 || cart.slipSpinTimer > 0) &&
        Math.random() < 0.45
      ) {
        this.spawnSkidMark(cart.x, cart.z, cart.rotY);
      }

      // Emit flames when in sugar rush turbo mode
      if (cart.sugarRushTimer > 0 && Math.random() < 0.5) {
        this.emitSugarFlames(cart.x, 0.4, cart.z, 3);
      }
    }

    // 2. Sync Ground Items
    const currentItemIds = new Set(world.groundItems.map((i) => i.id));
    for (const [id, mesh] of this.groundItemMeshes.entries()) {
      if (!currentItemIds.has(id)) {
        this.scene.remove(mesh);
        this.groundItemMeshes.delete(id);
      }
    }
    for (const it of world.groundItems) {
      let mesh = this.groundItemMeshes.get(it.id);
      if (!mesh) {
        mesh = createItemMesh(it.kind);
        this.scene.add(mesh);
        this.groundItemMeshes.set(it.id, mesh);
      }
      mesh.position.set(it.x, it.y, it.z);
      mesh.rotation.set(it.rotX, it.rotY, it.rotZ);
    }

    // 3. Sync Sample Kiosks
    for (const k of world.kiosks) {
      let km = this.kioskMeshes.get(k.id);
      if (!km) {
        const sampleName =
          k.sampleKind === 'sample_taquito'
            ? 'Taquitos'
            : k.sampleKind === 'sample_pizza_bagel'
              ? 'Pizza Bagels'
              : 'Churros';
        km = createSampleKiosk(k.aisleName, sampleName);
        km.position.set(k.x, k.y, k.z);
        this.scene.add(km);
        this.kioskMeshes.set(k.id, km);
      }

      if (k.active && Math.random() < 0.25) {
        // Emit rising steam from warming tray
        this.emitSteam(k.x, 1.2, k.z);
      }
    }

    // 4. Sync Hazard Plates & Spills
    const currentHazardIds = new Set(world.hazards.map((h) => h.id));
    for (const [id, mesh] of this.hazardMeshes.entries()) {
      if (!currentHazardIds.has(id)) {
        this.scene.remove(mesh);
        this.hazardMeshes.delete(id);
      }
    }
    for (const h of world.hazards) {
      let mesh = this.hazardMeshes.get(h.id);
      if (!mesh) {
        mesh = createPaperPlateHazard(h.kind);
        mesh.position.set(h.x, 0.01, h.z);
        mesh.rotation.y = h.rotation;
        this.scene.add(mesh);
        this.hazardMeshes.set(h.id, mesh);
      }
    }

    // 5. Sync NPC Shoppers
    for (const npc of world.npcShoppers) {
      let mesh = this.npcMeshes.get(npc.id);
      if (!mesh) {
        mesh = createShopperWorker(2); // Yellow/Orange wholesale club vest
        this.scene.add(mesh);
        this.npcMeshes.set(npc.id, mesh);
      }
      mesh.position.set(npc.x, 0, npc.z);
      mesh.rotation.y = npc.rotY;

      const isMoving = Math.abs(npc.vx) > 0.2 || Math.abs(npc.vz) > 0.2;
      poseShopper(mesh, world.clock / 1000, {
        role: 'driver',
        moving: isMoving,
        swatting: false,
        slipping: false,
      });
    }

    // 6. Update Visual Particles, Skid Marks & Comic Popups
    this.updateParticles(dt);
    this.updateSkidMarks(dt);
    this.updateComicPopups(dt);

    // Process new events for camera shake, particle effects and comic text popups
    for (const ev of world.events) {
      if (ev.type === 'cart_crash' || ev.type === 'shelf_tumble') {
        this.screenShake = Math.max(this.screenShake, 0.48);
        this.emitImpactDust(ev.x, ev.y, ev.z, 10);
        this.emitSparks(ev.x, ev.y, ev.z, 8);
      } else if (ev.type === 'plate_slip') {
        this.screenShake = Math.max(this.screenShake, 0.35);
        this.spawnSkidMark(ev.x, ev.z, 0);
      } else if (ev.type === 'sugar_rush') {
        this.emitSugarFlames(ev.x, ev.y, ev.z, 8);
      } else if (ev.type === 'receipt_approved') {
        this.emitConfetti(ev.x, ev.y + 1, ev.z);
      } else if (ev.type === 'receipt_rejected') {
        this.screenShake = Math.max(this.screenShake, 0.4);
      }

      if (ev.text) {
        this.spawnComicPopup(ev.x, ev.y + 1.2, ev.z, ev.text);
      }
    }
    world.events.length = 0; // Clear processed events

    // 7. Smooth Dynamic Third-Person Camera Follow with FOV Zoom & Screen Shake
    const myCart =
      world.carts.find((c) => c.id === localCartId) || world.carts[0];
    if (myCart) {
      // Dynamic FOV Zoom during Sugar Rush sprint mode
      const targetFov = myCart.sugarRushTimer > 0 ? 64 : 52;
      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov += (targetFov - this.camera.fov) * 0.12;
        this.camera.updateProjectionMatrix();
      }

      // Camera sits behind and slightly above the cart
      const followDist = 9.6;
      const followH = 5.6;
      const targetCamX = myCart.x - Math.cos(myCart.rotY) * followDist;
      const targetCamZ = myCart.z + Math.sin(myCart.rotY) * followDist;
      const targetCamY = followH;

      this.camera.position.x += (targetCamX - this.camera.position.x) * 0.12;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * 0.12;
      this.camera.position.y += (targetCamY - this.camera.position.y) * 0.12;

      // Apply camera screen shake
      if (this.screenShake > 0.01) {
        this.camera.position.x += (Math.random() - 0.5) * this.screenShake;
        this.camera.position.y += (Math.random() - 0.5) * this.screenShake;
        this.camera.position.z += (Math.random() - 0.5) * this.screenShake;
        this.screenShake *= Math.pow(0.04, dt);
      }

      // Look slightly ahead of the cart
      const lookX = myCart.x + Math.cos(myCart.rotY) * 2.5;
      const lookZ = myCart.z - Math.sin(myCart.rotY) * 2.5;
      this.camera.lookAt(lookX, 1.2, lookZ);
    }

    this.renderer.render(this.scene, this.camera);
  }

  private syncBasketItems(
    basket: THREE.Group,
    items: {
      id: string;
      kind: string;
      relX: number;
      relY: number;
      relZ: number;
      rotY: number;
    }[],
  ) {
    // Remove existing item meshes from basket
    for (let i = basket.children.length - 1; i >= 0; i--) {
      const child = basket.children[i];
      if (child.name === 'basket-item') {
        basket.remove(child);
      }
    }

    // Add up-to-date carried items inside the basket
    for (const it of items) {
      const itemMesh = createItemMesh(it.kind as ItemKind);
      itemMesh.name = 'basket-item';
      itemMesh.position.set(it.relX, it.relY, it.relZ);
      itemMesh.rotation.y = it.rotY;
      basket.add(itemMesh);
    }
  }

  public emitSparks(x: number, y: number, z: number, count = 5) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const mat = new THREE.MeshBasicMaterial({ color: 0xf1c40f });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 4 + 1,
        vz: (Math.random() - 0.5) * 6,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
      });
    }
  }

  public emitSugarFlames(x: number, y: number, z: number, count = 3) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.12, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? 0xe74c3c : 0xf39c12,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.5,
        y,
        z + (Math.random() - 0.5) * 0.5,
      );
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 3 + 2,
        vz: (Math.random() - 0.5) * 2,
        life: 0,
        maxLife: 0.45,
      });
    }
  }

  public emitSteam(x: number, y: number, z: number) {
    const geo = new THREE.SphereGeometry(0.09, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      x + (Math.random() - 0.5) * 0.4,
      y,
      z + (Math.random() - 0.5) * 0.4,
    );
    this.scene.add(mesh);

    this.particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 0.3,
      vy: 1.2 + Math.random() * 0.5,
      vz: (Math.random() - 0.5) * 0.3,
      life: 0,
      maxLife: 0.75,
    });
  }

  public emitConfetti(x: number, y: number, z: number) {
    const colors = [0xe74c3c, 0x2ecc71, 0x3498db, 0xf1c40f, 0x9b59b6];
    for (let i = 0; i < 35; i++) {
      const geo = new THREE.PlaneGeometry(0.18, 0.18);
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y + 1.5, z);
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 9,
        vy: Math.random() * 7 + 4,
        vz: (Math.random() - 0.5) * 9,
        life: 0,
        maxLife: 1.5,
      });
    }
  }

  public emitImpactDust(x: number, y: number, z: number, count = 8) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.12, 0.08, 0.12);
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? 0xc49a6c : 0xdfe6e9,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 5,
        vy: Math.random() * 3 + 1.2,
        vz: (Math.random() - 0.5) * 5,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.25,
      });
    }
  }

  public spawnSkidMark(x: number, z: number, rotY: number) {
    const geo = new THREE.PlaneGeometry(0.32, 0.85);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x1e272e,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -rotY;
    mesh.position.set(x, 0.008, z);
    this.scene.add(mesh);
    this.skidMarks.push({ mesh, life: 0, maxLife: 5.0 });

    if (this.skidMarks.length > 70) {
      const old = this.skidMarks.shift();
      if (old) {
        this.scene.remove(old.mesh);
        old.mesh.geometry.dispose();
      }
    }
  }

  private updateSkidMarks(dt: number) {
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      const sm = this.skidMarks[i];
      sm.life += dt;
      if (sm.life >= sm.maxLife) {
        this.scene.remove(sm.mesh);
        sm.mesh.geometry.dispose();
        this.skidMarks.splice(i, 1);
        continue;
      }
      const alpha = (1 - sm.life / sm.maxLife) * 0.45;
      (sm.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
    }
  }

  public spawnComicPopup(x: number, y: number, z: number, text: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;

    // Yellow comic bubble with thick border
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 140, 24);
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 12;
    ctx.stroke();

    // Bold comic text
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 54px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 82, 470);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.1), mat);
    mesh.position.set(x, y, z);
    mesh.quaternion.copy(this.camera.quaternion); // Billboard towards camera
    this.scene.add(mesh);

    this.comicPopups.push({
      mesh,
      vy: 2.2,
      rotSpeed: (Math.random() - 0.5) * 0.8,
      life: 0,
      maxLife: 1.4,
    });
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 9.8 * dt * 0.5; // gravity
      const scale = 1 - p.life / p.maxLife;
      p.mesh.scale.set(scale, scale, scale);
    }
  }

  private updateComicPopups(dt: number) {
    for (let i = this.comicPopups.length - 1; i >= 0; i--) {
      const cp = this.comicPopups[i];
      cp.life += dt;
      if (cp.life >= cp.maxLife) {
        this.scene.remove(cp.mesh);
        this.comicPopups.splice(i, 1);
        continue;
      }
      cp.mesh.position.y += cp.vy * dt;
      cp.mesh.quaternion.copy(this.camera.quaternion);
      const alpha = 1 - cp.life / cp.maxLife;
      (cp.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    this.keysDown.add(e.code);
    this.updateKeyInput();
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code);
    this.updateKeyInput();
  };

  private updateKeyInput() {
    let steer = 0;
    let throttle = 0;

    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) steer += 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight'))
      steer -= 1;
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp'))
      throttle += 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown'))
      throttle -= 1;

    const drift =
      this.keysDown.has('ShiftLeft') || this.keysDown.has('ShiftRight');
    const grabberAction =
      this.keysDown.has('Space') || this.keysDown.has('KeyE');

    this.currentInput = {
      x: steer,
      z: throttle,
      steer,
      throttle,
      drift,
      grabberAction,
    };
    this.callbacks.input(this.currentInput);
  }

  public setCustomInput(patch: Partial<PlayerInput>) {
    Object.assign(this.currentInput, patch);
    this.callbacks.input(this.currentInput);
  }

  private handleResize() {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public destroy() {
    cancelAnimationFrame(this.animFrame);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    for (const sm of this.skidMarks) {
      this.scene.remove(sm.mesh);
      sm.mesh.geometry.dispose();
    }
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(
        this.renderer.domElement,
      );
    }
    this.renderer.dispose();
  }
}
