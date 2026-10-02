import { shouldRenderFrame } from '../../shared/rendering/runtime';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { disposeObject } from '../../shared/rendering/dispose-object';
import { KeyedModels } from '../../shared/rendering/keyed-models';
import { REDUCED_MOTION_QUERY } from '../../shared/browser/device';
import * as THREE from 'three';
import { StampedeControls, GAME_KEYS, cameraTarget } from './controls';
import { ITEM_NAMES } from './ui-copy';
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
import { getEquippedLook } from '../../shared/wardrobe/wardrobe-state';
import {
  type ItemKind,
  type PlayerInput,
  type SampleStampedeSnapshot,
  type StampedeEvent,
} from './types';
import { WAREHOUSE_BOUNDS } from './physics';
import { createRenderer } from '../../shared/rendering/create-renderer';
import {
  addHouseLight,
  HOUSE_EXPOSURE,
  SKY,
} from '../../shared/rendering/house-light';

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

// Comfortably more ids than a room snapshot repeats.
const SHOWN_EVENT_MEMORY = 128;

/**
 * The events not shown yet, in order. A room snapshot repeats its world's
 * recent events, so ids already shown are skipped. The solo world keeps no
 * events, so its loop passes in each frame's own.
 */
export function eventsToShow(
  shown: Set<number>,
  kept: readonly StampedeEvent[],
  frame: readonly StampedeEvent[] = [],
): StampedeEvent[] {
  const fresh: StampedeEvent[] = [];
  for (const ev of [...kept, ...frame]) {
    if (shown.has(ev.id)) continue;
    shown.add(ev.id);
    fresh.push(ev);
  }
  // A Set iterates oldest first, so this forgets the longest-shown ids.
  for (const id of shown) {
    if (shown.size <= SHOWN_EVENT_MEMORY) break;
    shown.delete(id);
  }
  return fresh;
}

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

  private baskets = new WeakMap<
    THREE.Group,
    KeyedModels<
      {
        id: string;
        kind: string;
        relX: number;
        relY: number;
        relZ: number;
        rotY: number;
      },
      THREE.Group
    >
  >();
  private particles: Particle[] = [];
  private comicPopups: ComicPopup[] = [];
  private skidMarks: SkidMark[] = [];
  private screenShake = 0;
  private shownEvents = new Set<number>();
  private activeSteamSources: { x: number; y: number; z: number }[] = [];

  private language = 'en';
  private signs: { mesh: THREE.Group; aisle: number }[] = [];
  private checkout: THREE.Group | null = null;
  private cameraDestination = new THREE.Vector3();
  private originalCameraMaterials = new Set<THREE.Material>();
  private controls = new StampedeControls();
  private reducedMotion = false;
  private motionQuery: MediaQueryList;
  private cameraFresh = true;
  private outfit = '';
  private occluders: THREE.Object3D[] = [];
  private faded = new Set<THREE.Object3D>();
  private ray = new THREE.Raycaster();
  private cameraLook = new THREE.Vector3();
  private cameraDirection = new THREE.Vector3();
  private motionChange = () => {
    this.reducedMotion = this.motionQuery.matches;
  };

  constructor(
    container: HTMLElement,
    private callbacks: SceneCallbacks,
  ) {
    this.container = container;
    this.motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    this.motionChange();
    this.motionQuery.addEventListener('change', this.motionChange);

    // Renderer
    this.renderer = createRenderer(container, {
      exposure: HOUSE_EXPOSURE,
      focusable: false,
    }).renderer;
    this.renderer.setSize(container.clientWidth, container.clientHeight);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / container.clientHeight,
      0.5,
      250,
    );
    this.camera.position.set(0, 16, 22);

    this.setupLighting();
    this.setupWarehouseFloorAndRacks();

    // Input listeners
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearInput);
    document.addEventListener('visibilitychange', this.clearInput);

    // Resize handling
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.lastTime = performance.now();
  }

  private setupLighting() {
    // The collection's house light, in the warehouse hall.
    const { sun } = addHouseLight(this.scene, {
      sky: SKY.hall,
      fog: { near: 60, far: 160 },
    });
    sun.position.set(15, 30, 10);
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 70;
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.bias = -0.0008;
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
      batchScenery(rackN, [], true);
      this.scene.add(rackN);
      this.occluders.push(rackN);

      // South Shelf
      const rackS = createPalletRack(3.2, 4.8, 16.0);
      rackS.position.set(ax, 0, 10);
      batchScenery(rackS, [], true);
      this.scene.add(rackS);
      this.occluders.push(rackS);

      // Hanging Aisle Sign suspended above the aisle
      const sign = createAisleSign(idx + 1, aisleTitles[idx]);
      sign.position.set(ax, 5.2, 0);
      this.scene.add(sign);
      this.occluders.push(sign);
      this.signs.push({ mesh: sign, aisle: idx + 1 });
    });

    // Exit Receipt Gauntlet Booth
    const gauntlet = createExitGauntlet();
    gauntlet.position.set(0, 0, 28);
    this.scene.add(gauntlet);
    this.occluders.push(gauntlet);
    this.checkout = gauntlet;

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
      this.occluders.push(girder);
    }
  }

  private pendingVisualEvents: StampedeEvent[] = [];
  /** `frameEvents`: what the local simulation produced this frame. */
  public render(
    snapshot: SampleStampedeSnapshot,
    frameEvents: readonly StampedeEvent[] = [],
  ) {
    this.pendingVisualEvents.push(...frameEvents);
    if (this.pendingVisualEvents.length > 512)
      this.pendingVisualEvents.splice(0, this.pendingVisualEvents.length - 512);
    if (!shouldRenderFrame(this.renderer)) return;
    frameEvents = this.pendingVisualEvents;
    this.pendingVisualEvents = [];
    const { world, localCartId } = snapshot;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    const lookKey = JSON.stringify(getEquippedLook());
    if (lookKey !== this.outfit) {
      this.outfit = lookKey;
      const id = snapshot.localCartId;
      const cart = world.carts.find((cart) => cart.id === id);
      const rig = this.cartRigs.get(id);
      if (cart && rig) {
        const meshes =
          snapshot.myRole === 'grabber' ? this.riderMeshes : this.driverMeshes;
        const previous = meshes.get(id);
        if (previous) {
          previous.removeFromParent();
          disposeObject(previous);
        }
        const replacement = createShopperWorker(cart.team, getEquippedLook());
        replacement.rotation.y = Math.PI / 2;
        (snapshot.myRole === 'grabber'
          ? rig.riderAnchor
          : rig.driverAnchor
        ).add(replacement);
        meshes.set(id, replacement);
      }
    }
    // 1. Sync Carts
    for (const cart of world.carts) {
      let rig = this.cartRigs.get(cart.id);
      if (!rig) {
        rig = createShoppingCart(cart.team);
        this.scene.add(rig.root);
        this.cartRigs.set(cart.id, rig);

        // Your own wardrobe items show on the shopper you play in your cart.
        const mine = cart.id === snapshot.localCartId;
        const look = (role: 'driver' | 'grabber') =>
          mine && snapshot.myRole === role ? getEquippedLook() : undefined;

        // Add Driver Avatar
        const driver = createShopperWorker(cart.team, look('driver'));
        driver.rotation.y = Math.PI / 2; // Face forward (+X) toward cart handle!
        rig.driverAnchor.add(driver);
        this.driverMeshes.set(cart.id, driver);

        // Add Basket Rider Avatar
        const rider = createShopperWorker(cart.team, look('grabber'));
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
        disposeObject(mesh);
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
        const sampleName = (ITEM_NAMES[this.language] ?? ITEM_NAMES.en)[
          k.sampleKind
        ];
        km = createSampleKiosk(k.aisleName, sampleName, this.language);
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
        disposeObject(mesh);
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
        mesh = createShopperWorker(null);
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
    for (const ev of eventsToShow(
      this.shownEvents,
      world.events,
      frameEvents,
    )) {
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
        const text =
          this.language !== 'de'
            ? ev.text
            : ev.type === 'receipt_approved'
              ? 'ABGERECHNET!'
              : ev.type === 'receipt_rejected'
                ? 'TEDDY ENTFERNEN!'
                : ev.type === 'sample_announcement'
                  ? 'KOSTPROBEN!'
                  : 'BUMM!';
        this.spawnComicPopup(ev.x, ev.y + 1.2, ev.z, text);
      }
    }

    // 7. Smooth Dynamic Third-Person Camera Follow with FOV Zoom & Screen Shake
    const myCart =
      world.carts.find((c) => c.id === localCartId) || world.carts[0];
    if (myCart) {
      const targetFov =
        !this.reducedMotion && myCart.sugarRushTimer > 0 ? 64 : 58;
      this.camera.fov +=
        (targetFov - this.camera.fov) * (1 - Math.exp(-8 * dt));
      this.camera.updateProjectionMatrix();
      const target = cameraTarget(
        myCart.x,
        myCart.z,
        myCart.rotY,
        this.camera.aspect,
      );
      const blend = this.cameraFresh ? 1 : 1 - Math.exp(-10 * dt);
      this.camera.position.lerp(
        this.cameraDestination.set(target.x, target.y, target.z),
        blend,
      );
      this.cameraFresh = false;
      if (!this.reducedMotion && this.screenShake > 0.01) {
        this.camera.position.y += (Math.random() - 0.5) * this.screenShake;
      }
      this.screenShake *= Math.pow(0.04, dt);
      this.cameraLook.set(myCart.x, 1.2, myCart.z);
      this.camera.lookAt(this.cameraLook);
      // Fade complete rack/sign assemblies intersecting the line of sight.
      // Materials are cloned once so a faded rack never changes another rack.
      this.cameraDirection.subVectors(this.cameraLook, this.camera.position);
      const distance = this.cameraDirection.length();
      this.ray.set(this.camera.position, this.cameraDirection.normalize());
      this.ray.far = distance;
      this.scene.updateMatrixWorld(true);
      const obstructing = new Set<THREE.Object3D>();
      for (const hit of this.ray.intersectObjects(this.occluders, true)) {
        let root = hit.object;
        while (root.parent && root.parent !== this.scene) root = root.parent;
        obstructing.add(root);
      }
      for (const root of new Set([...this.faded, ...obstructing])) {
        const hidden = obstructing.has(root);
        root.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          if (!object.userData.cameraMaterials) {
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material])
              this.originalCameraMaterials.add(material);
            object.material = Array.isArray(object.material)
              ? object.material.map((material) => material.clone())
              : object.material.clone();
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material])
              material.userData.shared = false;
            object.userData.cameraMaterials = true;
          }
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            material.transparent = hidden;
            material.opacity = hidden ? 0.12 : 1;
            material.depthWrite = !hidden;
          }
        });
      }
      this.faded = obstructing;
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
    let models = this.baskets.get(basket);
    if (!models) {
      models = new KeyedModels(basket, (item) =>
        createItemMesh(item.kind as ItemKind),
      );
      this.baskets.set(basket, models);
    }
    models.sync(items, (mesh, item) => {
      mesh.position.set(item.relX, item.relY, item.relZ);
      mesh.rotation.y = item.rotY;
    });
  }

  public emitSparks(x: number, y: number, z: number, count = 5) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const mat = new THREE.MeshBasicMaterial({ color: 0xf1c40f });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);

      this.trimParticles();
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

      this.trimParticles();
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
    this.trimParticles();
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

      this.trimParticles();
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
      this.trimParticles();
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
        disposeObject(old.mesh);
      }
    }
  }

  private updateSkidMarks(dt: number) {
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      const sm = this.skidMarks[i];
      sm.life += dt;
      if (sm.life >= sm.maxLife) {
        this.scene.remove(sm.mesh);
        disposeObject(sm.mesh);
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

    if (this.comicPopups.length >= 12) {
      const popup = this.comicPopups.shift()!;
      popup.mesh.removeFromParent();
      disposeObject(popup.mesh);
    }
    this.comicPopups.push({
      mesh,
      vy: 2.2,
      rotSpeed: (Math.random() - 0.5) * 0.8,
      life: 0,
      maxLife: 1.4,
    });
  }

  private trimParticles() {
    while (this.particles.length >= 160) {
      const particle = this.particles.shift()!;
      particle.mesh.removeFromParent();
      disposeObject(particle.mesh);
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        disposeObject(p.mesh);
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
        disposeObject(cp.mesh);
        this.comicPopups.splice(i, 1);
        continue;
      }
      cp.mesh.position.y += cp.vy * dt;
      cp.mesh.quaternion.copy(this.camera.quaternion);
      const alpha = 1 - cp.life / cp.maxLife;
      (cp.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
    }
  }

  private acceptsKeyboard(event: KeyboardEvent) {
    return (
      this.controls.enabled &&
      !event.defaultPrevented &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      GAME_KEYS.has(event.code) &&
      !(
        event.target instanceof Element &&
        event.target.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], dialog',
        )
      )
    );
  }
  private handleKeyDown = (event: KeyboardEvent) => {
    if (!this.acceptsKeyboard(event)) return;
    if (
      event.code === 'Space' &&
      event.target instanceof Element &&
      event.target.closest('button, a')
    )
      return;
    event.preventDefault();
    this.controls.keys.add(event.code);
    this.callbacks.input(this.controls.read());
  };
  private handleKeyUp = (event: KeyboardEvent) => {
    if (!this.controls.keys.delete(event.code)) return;
    event.preventDefault();
    this.callbacks.input(this.controls.read());
  };
  private clearInput = () => {
    this.controls.reset();
    this.callbacks.input(this.controls.read());
  };
  public setInputEnabled(enabled: boolean) {
    if (enabled === this.controls.enabled) return;
    this.controls.enabled = enabled;
    this.clearInput();
  }
  public setCustomInput(patch: Partial<PlayerInput>) {
    if (!this.controls.enabled) return;
    Object.assign(this.controls.touch, patch);
    this.callbacks.input(this.controls.read());
  }
  public setLanguage(language: string) {
    if (language === this.language) return;
    this.language = language;
    const titles =
      language === 'de'
        ? [
            'Küchenrollen',
            'Müsli & Snacks',
            'Hundefutter',
            'Getränke',
            'Überraschungen',
          ]
        : [
            'Bulk Paper Goods',
            'Snack & Cereal Mountain',
            'Pet Monster Kibble',
            'Mega Beverages',
            'Mystery Mega Deals',
          ];
    const replace = (old: THREE.Group, next: THREE.Group) => {
      next.position.copy(old.position);
      this.occluders = this.occluders.map((root) =>
        root === old ? next : root,
      );
      this.faded.delete(old);
      old.removeFromParent();
      disposeObject(old);
      this.scene.add(next);
      return next;
    };
    for (const sign of this.signs)
      sign.mesh = replace(
        sign.mesh,
        createAisleSign(sign.aisle, titles[sign.aisle - 1], language),
      );
    if (this.checkout)
      this.checkout = replace(this.checkout, createExitGauntlet(language));
    for (const mesh of this.kioskMeshes.values()) {
      mesh.removeFromParent();
      disposeObject(mesh);
    }
    this.kioskMeshes.clear();
  }
  public resetRound() {
    this.clearInput();
    this.cameraFresh = true;
    this.shownEvents.clear();
    this.screenShake = 0;
    for (const effect of [
      ...this.particles,
      ...this.comicPopups,
      ...this.skidMarks,
    ]) {
      effect.mesh.removeFromParent();
      disposeObject(effect.mesh);
    }
    this.particles = [];
    this.comicPopups = [];
    this.skidMarks = [];
  }

  private handleResize() {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w <= 0 || h <= 0) return;
    this.cameraFresh = true;
    this.clearInput();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public destroy() {
    cancelAnimationFrame(this.animFrame);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clearInput);
    document.removeEventListener('visibilitychange', this.clearInput);
    this.motionQuery.removeEventListener('change', this.motionChange);
    for (const sm of this.skidMarks) {
      this.scene.remove(sm.mesh);
      disposeObject(sm.mesh);
    }
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(
        this.renderer.domElement,
      );
    }
    disposeObject(this.scene);
    for (const material of this.originalCameraMaterials)
      if (!material.userData.shared) material.dispose();
    this.renderer.dispose();
  }
}
