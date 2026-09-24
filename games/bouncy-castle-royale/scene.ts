import * as T from 'three';
import { createRenderer } from '../../shared/rendering/create-renderer';
import { shouldRenderFrame } from '../../shared/rendering/runtime';
import {
  addHouseLight,
  HOUSE_EXPOSURE,
} from '../../shared/rendering/house-light';
import { ball, box, taper } from '../../shared/rendering/primitives';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { InstancedProxy } from '../../shared/rendering/instanced-proxy';
import { disposeObject } from '../../shared/rendering/dispose-object';
import { CLOTH, TEAM } from '../../shared/rendering/palette';
import { buildStandaloneItem } from '../../shared/rendering/cosmetics/standalone-item';
import {
  getEquippedLook,
  subscribeWardrobe,
} from '../../shared/wardrobe/wardrobe-state';
import { castleLabel, castlePlayer, posePlayer, tower } from './models';
import { pumpPosition, wallHeight } from './simulation';
import { COURT, TEAMS, side, teamAt, type Snapshot, type Team } from './types';

type Avatar = {
  root: T.Group;
  body: T.Group;
  marker: T.Mesh;
  signature: string;
};

export class CastleScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(38, 1, 0.1, 150);
  private renderer: T.WebGLRenderer;
  private observer: ResizeObserver;
  private frame = 0;
  private self = 'local';
  private current: Snapshot | null = null;
  private avatars = new Map<string, Avatar>();
  private floor: T.Mesh[] = [];
  private floorProxy = new InstancedProxy(this.scene);
  private walls: { mesh: T.Mesh; team: Team }[] = [];
  private bumpers: { mesh: T.Mesh; team: Team }[] = [];
  private pumps = new Map<Team, T.Group>();
  private rings: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>[] = [];
  private ball = new T.Group();
  private shadow: T.Mesh;
  private unsubscribe: () => void;
  private lookVersion = 0;
  private previous = 0;

  constructor(private host: HTMLElement) {
    this.renderer = createRenderer(host, {
      label:
        'Bouncy Castle Royale. Move with WASD or arrows, Space to jump, F to volley, Q to change air, Shift to brace, E to pump.',
      exposure: HOUSE_EXPOSURE,
      shadows: 'soft',
    }).renderer;
    const { sun } = addHouseLight(this.scene, {
      sky: '#d7dfc5',
      fog: { near: 55, far: 110 },
    });
    sun.shadow.camera.left = sun.shadow.camera.bottom = -18;
    sun.shadow.camera.right = sun.shadow.camera.top = 18;
    sun.shadow.camera.far = 65;
    const fixed = new T.Group();
    this.scene.add(fixed);
    box(fixed, [150, 0.25, 150], [0, -0.65, 0], '#abc197');
    box(fixed, [15, 0.25, 19], [0, -0.4, 0], '#dbcdaa', true);
    box(fixed, [12.9, 0.55, 16.9], [0, 0, 0], '#e6bd66', true);
    for (const team of TEAMS)
      box(
        fixed,
        [12, 0.35, 8],
        [0, 0.15, side(team) * 4],
        team === 'red' ? '#efb392' : '#a9c8d5',
        true,
      );
    // Repeated cells share cached geometry; each can ripple without rebuilding it.
    for (let x = -5; x <= 5; x += 2)
      for (let z = -7; z <= 7; z += 2) {
        const tile = ball(
          this.scene,
          [0.99, 0.25, 0.99],
          [x, 0.26, z],
          z > 0 ? '#efb392' : '#a9c8d5',
          16,
        );
        this.floor.push(tile);
      }
    this.floorProxy.adopt(this.floor);
    for (const x of [-6.3, 6.3])
      for (const z of [-8.3, 8.3]) fixed.add(tower(x, z, TEAM[teamAt(z)]));
    for (const team of TEAMS) {
      const s = side(team);
      for (const x of [-6.05, 6.05]) {
        const mesh = ball(
          this.scene,
          [0.42, 0.5, 3.95],
          [x, 1, s * 4.05],
          TEAM[team],
          24,
        );
        this.walls.push({ mesh, team });
        for (const z of [2, 4, 6]) {
          const bumper = ball(
            this.scene,
            [0.48, 0.55, 0.6],
            [x * 0.93, 0.85, s * z],
            CLOTH.gold,
          );
          this.bumpers.push({ mesh: bumper, team });
        }
      }
      // The front rail is translucent so feet and the landing zone remain visible.
      const back = ball(
        this.scene,
        [5.9, 0.5, 0.42],
        [0, 1, s * 8.05],
        TEAM[team],
        24,
      );
      if (team === 'red') {
        back.material = back.material.clone();
        back.material.userData = {};
        back.material.transparent = true;
        back.material.opacity = 0.22;
        back.material.depthWrite = false;
        back.castShadow = false;
      }
      this.walls.push({ mesh: back, team });
      const pump = new T.Group(),
        pos = pumpPosition(team);
      pump.position.set(pos.x, COURT.floor, pos.z);
      taper(pump, 0.43, 0.5, 0.38, [0, 0.19, 0], CLOTH.gold, 16);
      taper(pump, 0.11, 0.11, 0.55, [0, 0.55, 0], CLOTH.charcoal);
      const handle = new T.Group();
      box(handle, [0.95, 0.13, 0.18], [0, 0.88, 0], CLOTH.cream, true);
      pump.add(handle);
      this.pumps.set(team, handle);
      this.scene.add(pump);
      const sign = castleLabel('AIR', '#fff1c8', 0.85);
      sign.position.set(pos.x, 1.9, pos.z);
      fixed.add(sign);
    }
    // A sparse string net keeps the ball readable against both halves.
    for (const x of [-6.2, 6.2]) {
      taper(fixed, 0.15, 0.2, 3.4, [x, 1.7, 0], CLOTH.gold, 12);
      ball(fixed, [0.26, 0.26, 0.26], [x, 3.45, 0], CLOTH.cream);
    }
    box(
      fixed,
      [12.4, 0.12, 0.12],
      [0, COURT.floor + COURT.net, 0],
      CLOTH.cream,
      true,
    );
    for (let x = -6; x <= 6; x += 0.6)
      box(fixed, [0.018, 1.5, 0.018], [x, 2.2, 0], '#f3edda');
    for (let y = 1.5; y < 3; y += 0.3)
      box(fixed, [12, 0.018, 0.018], [0, y, 0], '#f3edda');
    // Existing wardrobe party hats become little spectator decorations.
    for (const x of [-10, 10])
      for (const z of [-6, 0, 6]) {
        const cone = buildStandaloneItem(
          'party-cone',
          z > 0 ? TEAM.red : TEAM.blue,
        );
        cone.position.set(x, 0.1, z);
        cone.scale.setScalar(2.5);
        fixed.add(cone);
        ball(fixed, [0.9, 0.28, 0.9], [x, -0.2, z], '#91ad83');
      }
    batchScenery(fixed);
    ball(
      this.ball,
      [COURT.radius, COURT.radius, COURT.radius],
      [0, 0, 0],
      CLOTH.cream,
      24,
    );
    const stripe = new T.Mesh(
      new T.TorusGeometry(COURT.radius * 0.96, 0.028, 6, 32),
      new T.MeshStandardMaterial({ color: TEAM.blue, roughness: 0.8 }),
    );
    this.ball.add(stripe);
    const stripe2 = stripe.clone();
    stripe2.rotation.y = Math.PI / 2;
    this.ball.add(stripe2);
    this.scene.add(this.ball);
    this.shadow = new T.Mesh(
      new T.RingGeometry(0.28, 0.4, 32),
      new T.MeshBasicMaterial({
        color: '#695132',
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);
    for (let i = 0; i < 12; i++) {
      const ring = new T.Mesh(
        new T.RingGeometry(0.94, 1, 64),
        new T.MeshBasicMaterial({
          color: '#fff8d2',
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
          side: T.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      this.scene.add(ring);
      this.rings.push(ring);
    }
    this.unsubscribe = subscribeWardrobe(() => {
      this.lookVersion++;
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.frame = requestAnimationFrame(this.animate);
  }
  setLocalPlayer(id: string) {
    this.self = id;
    this.lookVersion++;
  }
  render(snapshot: Snapshot) {
    this.current = snapshot;
  }
  private resize() {
    const width = this.host.clientWidth,
      height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    const distance = Math.max(29, 28 / this.camera.aspect);
    this.camera.position.set(0, distance * 0.72, distance * 0.75);
    this.camera.lookAt(0, 0.6, 0);
    this.camera.updateProjectionMatrix();
  }
  private animate = (now: number) => {
    this.frame = requestAnimationFrame(this.animate);
    if (!shouldRenderFrame(this.renderer)) return;
    const dt = Math.min(0.1, (now - (this.previous || now)) / 1000);
    this.previous = now;
    const w = this.current?.world;
    if (w) {
      const smooth = 1 - Math.exp(-dt * 20),
        time = w.clock / 1000;
      for (const [id, avatar] of this.avatars)
        if (!w.players.some((p) => p.id === id)) {
          this.scene.remove(avatar.root);
          disposeObject(avatar.root);
          this.avatars.delete(id);
        }
      for (const p of w.players) {
        const local = p.id === this.self;
        const signature = `${p.team}:${p.name}:${local}:${local ? this.lookVersion : 0}`;
        let avatar = this.avatars.get(p.id);
        if (!avatar || avatar.signature !== signature) {
          if (avatar) {
            this.scene.remove(avatar.root);
            disposeObject(avatar.root);
          }
          const root = new T.Group(),
            body = castlePlayer(
              p.team,
              p.color,
              local ? getEquippedLook() : undefined,
            );
          root.add(body);
          const name = castleLabel(
            local ? 'YOU' : `${p.name}${p.bot ? ' • BOT' : ''}`,
            local ? '#fff5b4' : '#fff8ea',
            local ? 1.2 : 2,
          );
          name.position.y = 2.45;
          root.add(name);
          const marker = new T.Mesh(
            new T.RingGeometry(local ? 0.52 : 0.4, local ? 0.65 : 0.47, 24),
            new T.MeshBasicMaterial({
              color: local ? '#fff5b4' : TEAM[p.team],
              side: T.DoubleSide,
            }),
          );
          marker.rotation.x = -Math.PI / 2;
          root.add(marker);
          root.position.set(p.x, p.y, p.z);
          this.scene.add(root);
          avatar = { root, body, marker, signature };
          this.avatars.set(p.id, avatar);
        }
        avatar.root.position.lerp(new T.Vector3(p.x, p.y, p.z), smooth);
        avatar.marker.position.y = COURT.floor + 0.04 - avatar.root.position.y;
        const moving = Math.hypot(p.vx, p.vz) > 0.25;
        const heading = moving
          ? Math.atan2(p.vx, p.vz)
          : p.team === 'red'
            ? Math.PI
            : 0;
        const angle = Math.atan2(
          Math.sin(heading - avatar.body.rotation.y),
          Math.cos(heading - avatar.body.rotation.y),
        );
        avatar.body.rotation.y += angle * smooth;
        posePlayer(avatar.body, p, time);
      }
      this.ball.position.lerp(
        new T.Vector3(w.ball.x, w.ball.y, w.ball.z),
        smooth,
      );
      this.ball.rotation.x += w.ball.vz * dt;
      this.ball.rotation.z -= w.ball.vx * dt;
      this.shadow.position.set(w.ball.x, COURT.floor + 0.04, w.ball.z);
      this.shadow.scale.setScalar(1 + Math.max(0, w.ball.y - 1) * 0.08);
      for (const tile of this.floor) {
        let ripple = 0;
        for (const wave of w.waves) {
          const radius = ((w.clock - wave.born) / 1000) * 8;
          const distance = Math.hypot(
            tile.position.x - wave.x,
            tile.position.z - wave.z,
          );
          ripple +=
            Math.exp(-Math.pow(distance - radius, 2) * 2) * wave.power * 0.35;
        }
        tile.position.y = 0.26 + ripple;
      }
      for (const { mesh, team } of this.walls) {
        const height = wallHeight(w, team);
        mesh.scale.y = height / 2;
        mesh.position.y = COURT.floor + height / 2;
      }
      for (const { mesh, team } of this.bumpers)
        mesh.scale.x = 0.28 + w.air[team].bumpers * w.air[team].pressure * 0.8;
      for (const team of TEAMS)
        this.pumps.get(team)!.position.y = w.players.some(
          (p) => p.team === team && p.input.pump,
        )
          ? Math.sin(time * 16) * 0.13
          : 0;
      this.rings.forEach((ring, i) => {
        const wave = w.waves[i];
        ring.visible = !!wave;
        if (!wave) return;
        const progress = (w.clock - wave.born) / 1000;
        ring.position.set(wave.x, COURT.floor + 0.12, wave.z);
        ring.scale.setScalar(Math.max(0.05, progress * 8));
        ring.material.opacity = (1 - progress) * 0.65;
      });
    }
    this.floorProxy.update();
    this.renderer.render(this.scene, this.camera);
  };
  dispose() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.unsubscribe();
    this.floorProxy.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
