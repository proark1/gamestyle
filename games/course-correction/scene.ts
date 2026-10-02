import * as T from 'three';
import { createRenderer } from '../../shared/rendering/create-renderer';
import {
  addHouseLight,
  HOUSE_EXPOSURE,
} from '../../shared/rendering/house-light';
import { COLORS, type CourseSnapshot, type CourseState } from './types';
import { cupPosition } from './courses';
import {
  addBridgeDetails,
  addCourseSurfaceDetails,
  addPlatformDetails,
} from './scenery';
import { CameraImpulseController } from './effects';
import { feedbackTier, presentationProfile } from './presentation';
import { CourseCharacters } from './characters';
import { courseCameraPose } from './camera-presentation';
import { createBackyardEnvironment } from './environment';
import { CourseSpectators } from './spectators';
import { disposeObject } from '../../shared/rendering/dispose-object';
import { prefersReducedMotion } from '../../shared/browser/device';

const mat = (color: string, roughness = 0.75) =>
  new T.MeshStandardMaterial({ color, roughness });

export class CourseCorrectionScene {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera: T.PerspectiveCamera;
  private observer: ResizeObserver;
  private world = new T.Group();
  private walls = new Map<string, T.Group>();
  private balls = new Map<string, T.Mesh>();
  private bridge?: T.Group;
  private platform?: T.Group;
  private cup?: T.Group;
  private flag?: T.Mesh;
  private targetRing?: T.Mesh;
  private aimLine?: T.Line;
  private trails = new Map<string, T.Line>();
  private trailPoints = new Map<string, T.Vector3[]>();
  private drops = new Map<string, number>();
  private eventMeshes: Array<{
    mesh: T.Mesh;
    born: number;
    lifetime: number;
    rise: number;
  }> = [];
  private lastEvent = 0;
  private flagKick = 0;
  private previousFrame = performance.now();
  private cameraImpulse = new CameraImpulseController();
  private cameraPosition = new T.Vector3();
  private cameraLook = new T.Vector3();
  private cameraReady = false;
  private portrait = false;
  private aiming = false;
  private reducedMotion = prefersReducedMotion();
  private mobile = matchMedia('(max-width: 720px)').matches;
  private profile = presentationProfile(this.reducedMotion, this.mobile);
  private characters = new CourseCharacters(this.reducedMotion, this.mobile);
  private environment?: T.Group;
  private spectators?: CourseSpectators;
  private local = 'local';
  private courseId = '';
  private ray = new T.Raycaster();
  private plane = new T.Plane(new T.Vector3(0, 1, 0), 0);

  constructor(private host: HTMLDivElement) {
    this.renderer = createRenderer(host, {
      exposure: HOUSE_EXPOSURE,
      focusable: false,
    }).renderer;
    this.camera = new T.PerspectiveCamera(46, 1, 0.1, 90);
    this.scene.background = new T.Color('#72cde3');
    this.scene.fog = new T.Fog('#72cde3', 31, 54);
    addHouseLight(this.scene, { sky: '#72cde3' });
    try {
      this.environment = createBackyardEnvironment();
      this.scene.add(this.environment);
    } catch (error) {
      console.warn('Course Correction environment unavailable', error);
    }
    try {
      this.spectators = new CourseSpectators(this.reducedMotion, this.mobile);
      this.scene.add(this.spectators.root);
    } catch (error) {
      console.warn('Course Correction spectators unavailable', error);
    }
    this.scene.add(this.world);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
  }

  setLocalPlayer(id: string) {
    this.local = id;
    this.characters.setLocalPlayer(id);
  }

  setAiming(active: boolean) {
    this.aiming = active;
  }

  private resize() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    // Keep the CSS canvas at the full host size. The renderer's pixel-ratio
    // policy may lower the internal buffer on mobile, but must not shrink the
    // visible course and clip golfers along the right edge.
    this.renderer.setSize(width, height, true);
    this.camera.aspect = width / height;
    this.portrait = this.camera.aspect < 0.72;
    this.camera.fov = this.portrait ? 56 : 46;
    this.camera.updateProjectionMatrix();
  }

  private mesh(geometry: T.BufferGeometry, material: T.Material) {
    const mesh = new T.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private rebuild(course: CourseState) {
    this.characters.reset();
    disposeObject(this.world);
    this.world.clear();
    this.walls.clear();
    this.balls.clear();
    this.trails.clear();
    this.trailPoints.clear();
    this.drops.clear();
    this.eventMeshes = [];
    this.aimLine = undefined;
    this.bridge = this.platform = this.cup = undefined;
    this.flag = this.targetRing = undefined;
    this.courseId = course.id;
    const turf = this.mesh(
      new T.BoxGeometry(course.width, 0.34, course.length),
      mat('#3fa66c', 0.94),
    );
    turf.position.set(0, -0.2, course.length / 2);
    this.world.add(turf);
    const railMaterial = mat('#f7f4e8');
    for (const x of [-course.width / 2 - 0.12, course.width / 2 + 0.12]) {
      const rail = this.mesh(
        new T.BoxGeometry(0.24, 0.45, course.length + 0.4),
        railMaterial,
      );
      rail.position.set(x, 0.08, course.length / 2);
      this.world.add(rail);
    }
    const back = this.mesh(
      new T.BoxGeometry(course.width + 0.5, 0.45, 0.24),
      railMaterial,
    );
    back.position.set(0, 0.08, course.length + 0.12);
    this.world.add(back);
    addCourseSurfaceDetails(this.world, course, (geometry, material) =>
      this.mesh(geometry, material),
    );
    for (const state of course.walls) {
      const group = new T.Group();
      const wall = this.mesh(
        new T.BoxGeometry(state.width, 0.72, state.depth),
        mat('#f26a3d'),
      );
      wall.position.y = 0.28;
      const hinge = this.mesh(
        new T.CylinderGeometry(0.16, 0.16, 0.9, 12),
        mat('#17354a'),
      );
      hinge.position.y = 0.35;
      const hingeCap = this.mesh(
        new T.CylinderGeometry(0.22, 0.22, 0.08, 16),
        mat('#f5d85c', 0.5),
      );
      hingeCap.position.y = 0.81;
      const stripe = this.mesh(
        new T.BoxGeometry(state.width * 0.62, 0.1, state.depth + 0.03),
        mat('#f5d85c'),
      );
      stripe.position.y = 0.55;
      group.add(wall, hinge, hingeCap, stripe);
      this.world.add(group);
      this.walls.set(state.id, group);
    }
    if (course.bridge) {
      const group = new T.Group();
      const deck = this.mesh(
        new T.BoxGeometry(course.bridge.width, 0.18, course.bridge.depth),
        mat('#f5d85c'),
      );
      deck.position.y = 0.12;
      group.add(deck);
      addBridgeDetails(group, course.bridge.width, (geometry, material) =>
        this.mesh(geometry, material),
      );
      this.world.add(group);
      this.bridge = group;
    }
    if (course.platform) {
      const group = new T.Group();
      const slab = this.mesh(
        new T.CylinderGeometry(1.45, 1.45, 0.2, 24),
        mat('#f7f4e8'),
      );
      slab.position.y = 0.04;
      group.add(slab);
      addPlatformDetails(group, (geometry, material) =>
        this.mesh(geometry, material),
      );
      this.world.add(group);
      this.platform = group;
    }
    const cup = new T.Group();
    const rim = this.mesh(
      new T.TorusGeometry(0.4, 0.07, 8, 24),
      mat('#17354a'),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.025;
    const hole = this.mesh(
      new T.CylinderGeometry(0.32, 0.32, 0.12, 24),
      mat('#071821', 0.92),
    );
    hole.position.y = -0.055;
    const targetRing = this.mesh(
      new T.RingGeometry(0.52, 0.66, 32),
      new T.MeshBasicMaterial({
        color: '#f5d85c',
        transparent: true,
        opacity: 0.38,
        side: T.DoubleSide,
      }),
    );
    targetRing.rotation.x = -Math.PI / 2;
    targetRing.position.y = 0.016;
    const pole = this.mesh(
      new T.CylinderGeometry(0.025, 0.025, 1.8, 8),
      mat('#f7f4e8'),
    );
    pole.position.set(0, 0.9, 0);
    const flag = this.mesh(new T.PlaneGeometry(0.68, 0.4), mat('#f26a3d'));
    flag.position.set(0.34, 1.48, 0);
    flag.geometry.translate(0.34, 0, 0);
    flag.position.x = 0;
    cup.add(hole, targetRing, rim, pole, flag);
    this.world.add(cup);
    this.cup = cup;
    this.flag = flag;
    this.targetRing = targetRing;
    this.addHouseholdObstacles(course);
    this.world.add(this.characters.root);
  }

  private addHouseholdObstacles(course: CourseState) {
    for (const obstacle of course.obstacles) {
      if (obstacle.kind === 'cone') {
        const cone = new T.Group();
        const base = this.mesh(
          new T.BoxGeometry(0.76, 0.09, 0.76),
          mat('#17354a'),
        );
        base.position.y = 0.045;
        const body = this.mesh(
          new T.ConeGeometry(0.31, 0.82, 14),
          mat('#f26a3d'),
        );
        body.position.y = 0.46;
        const band = this.mesh(
          new T.CylinderGeometry(0.22, 0.27, 0.15, 14),
          mat('#f7f4e8'),
        );
        band.position.y = 0.38;
        cone.add(base, body, band);
        cone.position.set(obstacle.x, 0, obstacle.z);
        cone.rotation.z = 0.035;
        this.world.add(cone);
      } else if (obstacle.kind === 'pan') {
        const pan = new T.Group();
        const bowl = this.mesh(
          new T.CylinderGeometry(0.58, 0.5, 0.16, 22),
          mat('#17354a', 0.42),
        );
        const handle = this.mesh(
          new T.BoxGeometry(1.05, 0.12, 0.2),
          mat('#17354a'),
        );
        handle.position.x = 0.86;
        const inner = this.mesh(
          new T.CylinderGeometry(0.45, 0.45, 0.02, 20),
          mat('#456277', 0.36),
        );
        inner.position.y = 0.09;
        pan.add(bowl, inner, handle);
        pan.position.set(obstacle.x, 0.12, obstacle.z);
        this.world.add(pan);
      } else {
        const washer = new T.Group();
        const body = this.mesh(
          new T.BoxGeometry(1.35, 1.55, 1.15),
          mat('#f7f4e8'),
        );
        body.position.y = 0.78;
        const door = this.mesh(
          new T.TorusGeometry(0.38, 0.09, 10, 24),
          mat('#17354a', 0.45),
        );
        door.position.set(0, 0.82, -0.59);
        const glass = this.mesh(
          new T.CircleGeometry(0.3, 24),
          new T.MeshStandardMaterial({
            color: '#72cde3',
            roughness: 0.22,
            transparent: true,
            opacity: 0.72,
          }),
        );
        glass.position.set(0, 0.82, -0.596);
        washer.add(body, door, glass);
        washer.position.set(obstacle.x, 0, obstacle.z);
        this.world.add(washer);
      }
    }
  }

  render(snapshot: CourseSnapshot) {
    const { world } = snapshot;
    if (world.course.id !== this.courseId) this.rebuild(world.course);
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - this.previousFrame) / 1000));
    this.previousFrame = now;
    this.processEvents(snapshot, now);
    for (const wall of world.course.walls) {
      const group = this.walls.get(wall.id);
      if (group) {
        group.position.set(wall.x, 0, wall.z);
        group.rotation.y = -wall.angle;
      }
    }
    if (this.bridge && world.course.bridge) {
      this.bridge.position.set(world.course.bridge.x, 0, world.course.bridge.z);
      this.bridge.rotation.z = world.course.bridge.angle;
    }
    if (this.platform && world.course.platform)
      this.platform.position.set(
        world.course.platform.baseX + world.course.platform.offset,
        0,
        world.course.platform.z,
      );
    const cup = cupPosition(world.course);
    this.cup?.position.set(cup.x, 0.02, cup.z);
    if (this.flag) {
      this.flagKick *= Math.exp(-dt * 7.5);
      this.flag.rotation.y = Math.sin(now * 0.006) * 0.08 + this.flagKick;
      this.flag.rotation.z = Math.sin(now * 0.011) * 0.025;
    }
    if (this.targetRing) {
      const pulse = 1 + Math.sin(now * 0.0045) * 0.07;
      this.targetRing.scale.setScalar(pulse);
    }
    const alive = new Set<string>();
    for (const ball of world.balls) {
      alive.add(ball.id);
      let mesh = this.balls.get(ball.id);
      if (!mesh) {
        const seat = world.players.find((p) => p.id === ball.owner)?.seat ?? 0;
        mesh = this.mesh(
          new T.SphereGeometry(ball.radius, 24, 18),
          mat(COLORS[seat], 0.25),
        );
        this.world.add(mesh);
        this.balls.set(ball.id, mesh);
        if (this.profile.trails) {
          const trail = new T.Line(
            new T.BufferGeometry().setFromPoints([
              new T.Vector3(ball.x, 0.08, ball.z),
              new T.Vector3(ball.x, 0.08, ball.z),
            ]),
            new T.LineBasicMaterial({
              color: COLORS[seat],
              transparent: true,
              opacity: 0.48,
            }),
          );
          this.world.add(trail);
          this.trails.set(ball.id, trail);
          this.trailPoints.set(ball.id, []);
        }
      }
      if (ball.holed && !this.drops.has(ball.id)) this.drops.set(ball.id, now);
      const dropAge = now - (this.drops.get(ball.id) ?? now);
      mesh.visible = !ball.holed || dropAge < 520;
      const drop = ball.holed ? Math.min(1, dropAge / 430) : 0;
      mesh.position.set(ball.x, ball.radius + 0.02 - drop * 0.58, ball.z);
      mesh.scale.setScalar(1 - drop * 0.42);
      mesh.rotation.x += ball.vz * 0.012;
      mesh.rotation.z -= ball.vx * 0.012;
      this.updateTrail(ball.id, mesh.position, ball.moving && !ball.holed);
    }
    for (const [id, mesh] of this.balls)
      if (!alive.has(id)) {
        this.world.remove(mesh);
        disposeObject(mesh);
        this.balls.delete(id);
        const trail = this.trails.get(id);
        if (trail) {
          this.world.remove(trail);
          disposeObject(trail);
        }
        this.trails.delete(id);
        this.trailPoints.delete(id);
      }
    this.characters.update(snapshot, now, dt);
    this.spectators?.update(snapshot, now, dt);
    this.updateEffects(now);
    const pose = courseCameraPose(
      world,
      this.portrait,
      this.aiming,
      this.reducedMotion,
    );
    const targetPosition = new T.Vector3(
      pose.position.x,
      pose.position.y,
      pose.position.z,
    );
    const targetLook = new T.Vector3(pose.look.x, pose.look.y, pose.look.z);
    if (!this.cameraReady) {
      this.cameraPosition.copy(targetPosition);
      this.cameraLook.copy(targetLook);
      this.cameraReady = true;
    } else {
      const blend = 1 - Math.exp(-dt * (pose.mode === 'aim' ? 5.2 : 3.2));
      this.cameraPosition.lerp(targetPosition, blend);
      this.cameraLook.lerp(targetLook, blend);
    }
    const impulse = this.cameraImpulse.update(dt);
    this.camera.position
      .copy(this.cameraPosition)
      .add(new T.Vector3(impulse.x, impulse.y, impulse.zoom));
    this.camera.lookAt(
      this.cameraLook.x + impulse.x * 0.3,
      this.cameraLook.y,
      this.cameraLook.z + impulse.zoom * 0.7,
    );
    this.updateAim(snapshot);
    this.renderer.render(this.scene, this.camera);
  }

  private processEvents(snapshot: CourseSnapshot, now: number) {
    for (const event of snapshot.world.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      const tier = feedbackTier(event);
      const strength =
        tier === 'celebration'
          ? 1
          : tier === 'major'
            ? 0.72
            : tier === 'course'
              ? 0.42
              : 0;
      if (strength)
        this.cameraImpulse.kick(strength * this.profile.camera, event.id);
      if (event.kind === 'cup' || event.kind === 'multi-cup')
        this.flagKick = event.kind === 'multi-cup' ? 0.75 : 0.38;
      this.spawnImpact(event.x, event.z, tier, now);
    }
  }

  private spawnImpact(
    x: number,
    z: number,
    tier: ReturnType<typeof feedbackTier>,
    now: number,
  ) {
    const color =
      tier === 'celebration'
        ? '#f5d85c'
        : tier === 'major'
          ? '#72cde3'
          : tier === 'course'
            ? '#f26a3d'
            : '#f7f4e8';
    const ring = this.mesh(
      new T.RingGeometry(0.2, 0.28, 24),
      new T.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: tier === 'minor' ? 0.62 : 0.9,
        side: T.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.07, z);
    this.world.add(ring);
    this.eventMeshes.push({
      mesh: ring,
      born: now,
      lifetime: tier === 'minor' ? 360 : 650,
      rise: 0,
    });
    const count =
      tier === 'celebration'
        ? Math.min(this.profile.particles, 18)
        : tier === 'major'
          ? Math.min(this.profile.particles, 9)
          : tier === 'course'
            ? Math.min(this.profile.particles, 6)
            : 2;
    for (let index = 0; index < count; index++) {
      const particle = this.mesh(
        new T.SphereGeometry(0.035 + (index % 3) * 0.012, 6, 4),
        new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.84 }),
      );
      const angle = (index / Math.max(1, count)) * Math.PI * 2;
      particle.position.set(
        x + Math.cos(angle) * 0.18,
        0.11,
        z + Math.sin(angle) * 0.18,
      );
      particle.userData.dx = Math.cos(angle) * (0.7 + (index % 4) * 0.14);
      particle.userData.dz = Math.sin(angle) * (0.7 + (index % 4) * 0.14);
      this.world.add(particle);
      this.eventMeshes.push({
        mesh: particle,
        born: now,
        lifetime: 520,
        rise: 0.9,
      });
    }
    while (this.eventMeshes.length > this.profile.particles + 10) {
      const stale = this.eventMeshes.shift();
      if (stale) this.world.remove(stale.mesh);
    }
  }

  private updateEffects(now: number) {
    for (const effect of this.eventMeshes) {
      const progress = Math.min(1, (now - effect.born) / effect.lifetime);
      const material = effect.mesh.material as T.MeshBasicMaterial;
      material.opacity = (1 - progress) * 0.88;
      if (effect.rise) {
        effect.mesh.position.x += (effect.mesh.userData.dx ?? 0) * 0.012;
        effect.mesh.position.z += (effect.mesh.userData.dz ?? 0) * 0.012;
        effect.mesh.position.y += effect.rise * 0.012 * (1 - progress);
      } else {
        effect.mesh.scale.setScalar(1 + progress * 4.2);
      }
    }
    const expired = this.eventMeshes.filter(
      (effect) => now - effect.born >= effect.lifetime,
    );
    for (const effect of expired) {
      this.world.remove(effect.mesh);
      disposeObject(effect.mesh);
    }
    this.eventMeshes = this.eventMeshes.filter(
      (effect) => now - effect.born < effect.lifetime,
    );
  }

  private updateTrail(id: string, position: T.Vector3, moving: boolean) {
    const trail = this.trails.get(id);
    const points = this.trailPoints.get(id);
    if (!trail || !points) return;
    trail.visible = moving;
    if (!moving) {
      points.length = 0;
      return;
    }
    const latest = points.at(-1);
    if (!latest || latest.distanceTo(position) > 0.12) {
      points.push(position.clone().setY(0.065));
      if (points.length > 10) points.shift();
      trail.geometry.dispose();
      trail.geometry = new T.BufferGeometry().setFromPoints(points);
    }
  }

  private updateAim(snapshot: CourseSnapshot) {
    const player = snapshot.world.players.find((p) => p.id === this.local);
    const ball = snapshot.world.balls.find((b) => b.owner === this.local);
    if (!player || !ball || ball.holed || ball.moving) {
      if (this.aimLine) this.aimLine.visible = false;
      return;
    }
    if (!this.aimLine) {
      this.aimLine = new T.Line(
        new T.BufferGeometry().setAttribute(
          'position',
          new T.Float32BufferAttribute(new Float32Array(6), 3),
        ),
        new T.LineBasicMaterial({ color: '#f5d85c' }),
      );
      this.world.add(this.aimLine);
    }
    const length = 1.8 + player.power * 3.2;
    const position = this.aimLine.geometry.getAttribute('position');
    position.setXYZ(0, ball.x, 0.1, ball.z);
    position.setXYZ(
      1,
      ball.x + Math.sin(player.aim) * length,
      0.1,
      ball.z + Math.cos(player.aim) * length,
    );
    position.needsUpdate = true;
    this.aimLine.geometry.computeBoundingSphere();
    this.aimLine.visible = true;
  }

  aim(clientX: number, clientY: number) {
    const rect = this.host.getBoundingClientRect();
    const pointer = new T.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.ray.setFromCamera(pointer, this.camera);
    const point = new T.Vector3();
    return this.ray.ray.intersectPlane(this.plane, point)
      ? { x: point.x, z: point.z }
      : null;
  }

  dispose() {
    this.observer.disconnect();
    this.cameraImpulse.reset();
    this.characters.dispose();
    this.spectators?.dispose();
    if (this.environment) disposeObject(this.environment);
    disposeObject(this.world);
    this.renderer.dispose();
    this.host.replaceChildren();
  }
}
