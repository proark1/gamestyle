import * as T from 'three';
import { dressedGameAvatar } from '../../shared/rendering/game-avatar';
import { disposeObject } from '../../shared/rendering/dispose-object';
import { poseWorker } from '../../shared/rendering/worker-pose';
import { CLOTH, SEAT_KITS } from '../../shared/rendering/palette';
import {
  getEquippedLook,
  subscribeWardrobe,
} from '../../shared/wardrobe/wardrobe-state';
import {
  CharacterEventTracker,
  celebrationPosition,
  characterMode,
  facingAngle,
  stagingPosition,
  type CharacterMode,
  type CharacterPoint,
} from './character-presentation';
import type { CoursePlayer, CourseSnapshot, GolfBall } from './types';

type Golfer = {
  root: T.Group;
  body: T.Group;
  putter: T.Group;
  marker: T.Mesh;
  signature: string;
  swingAt: number;
  swingUntil: number;
  cheerUntil: number;
};

const moveToward = (current: number, target: number, amount: number) => {
  const delta = target - current;
  return current + Math.sign(delta) * Math.min(Math.abs(delta), amount);
};

const turnToward = (current: number, target: number, amount: number) => {
  const delta = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + Math.sign(delta) * Math.min(Math.abs(delta), amount);
};

export class CourseCharacters {
  readonly root = new T.Group();
  private golfers = new Map<string, Golfer>();
  private events = new CharacterEventTracker();
  private local = 'local';
  private lookVersion = 0;
  private unsubscribe = subscribeWardrobe(() => this.lookVersion++);

  constructor(
    private reducedMotion: boolean,
    private mobile: boolean,
  ) {
    this.root.name = 'course-golfers';
  }

  setLocalPlayer(id: string) {
    if (this.local === id) return;
    this.local = id;
    this.lookVersion++;
  }

  update(snapshot: CourseSnapshot, now: number, dt: number) {
    for (const reaction of this.events.ingest(snapshot)) {
      if (
        snapshot.world.clock - this.eventTime(snapshot, reaction.eventId) >
        1_400
      )
        continue;
      const golfer = this.golfers.get(reaction.player);
      if (!golfer) continue;
      if (reaction.kind === 'swing') {
        golfer.swingAt = now;
        golfer.swingUntil = now + (this.reducedMotion ? 280 : 680);
      } else {
        golfer.cheerUntil = Math.max(
          golfer.cheerUntil,
          now + (reaction.kind === 'assist' ? 1_050 : 1_800),
        );
      }
    }

    const active = new Set<string>();
    for (const player of snapshot.world.players) {
      active.add(player.id);
      const ball = snapshot.world.balls.find(
        (candidate) => candidate.owner === player.id,
      );
      if (!ball) continue;
      const signature = `${player.seat}:${player.id === this.local}:${
        player.id === this.local ? this.lookVersion : 0
      }`;
      let golfer = this.golfers.get(player.id);
      if (!golfer || golfer.signature !== signature) {
        if (golfer) this.remove(player.id, golfer);
        golfer = this.create(player, signature);
        const initial = this.target(snapshot, player, ball);
        golfer.root.position.set(initial.x, 0.035, initial.z);
        golfer.root.rotation.y = player.aim;
        this.root.add(golfer.root);
        this.golfers.set(player.id, golfer);
      }
      this.updateGolfer(golfer, snapshot, player, ball, now, dt);
    }
    for (const [id, golfer] of this.golfers)
      if (!active.has(id)) this.remove(id, golfer);
  }

  private eventTime(snapshot: CourseSnapshot, id: number) {
    return snapshot.world.events.find((event) => event.id === id)?.at ?? 0;
  }

  private target(
    snapshot: CourseSnapshot,
    player: CoursePlayer,
    ball: GolfBall,
  ): CharacterPoint {
    return ball.holed
      ? celebrationPosition(snapshot.world.course, player.seat)
      : stagingPosition(snapshot.world.course, ball, player.aim);
  }

  private updateGolfer(
    golfer: Golfer,
    snapshot: CourseSnapshot,
    player: CoursePlayer,
    ball: GolfBall,
    now: number,
    dt: number,
  ) {
    const desired = this.target(snapshot, player, ball);
    const distance = Math.hypot(
      desired.x - golfer.root.position.x,
      desired.z - golfer.root.position.z,
    );
    const swinging = now < golfer.swingUntil;
    const mode = characterMode(snapshot.world, player.id, distance, swinging);

    if (mode === 'walk' || mode === 'celebrate') {
      const speed = this.reducedMotion ? 8 : mode === 'walk' ? 3.15 : 2.3;
      golfer.root.position.x = moveToward(
        golfer.root.position.x,
        desired.x,
        speed * dt,
      );
      golfer.root.position.z = moveToward(
        golfer.root.position.z,
        desired.z,
        speed * dt,
      );
    }

    const lookAt =
      mode === 'walk' && distance > 0.03 ? desired : { x: ball.x, z: ball.z };
    const heading = facingAngle(golfer.root.position, lookAt);
    golfer.root.rotation.y = turnToward(
      golfer.root.rotation.y,
      heading,
      dt * (this.reducedMotion ? 20 : 7.5),
    );
    this.pose(golfer, mode, player.seat, now);
    golfer.marker.visible = !this.mobile || player.id === this.local;
  }

  private pose(golfer: Golfer, mode: CharacterMode, seat: number, now: number) {
    const seconds = now / 1_000;
    if (mode === 'walk') poseWorker(golfer.body, seconds, 'walk');
    else if (mode === 'celebrate' || now < golfer.cheerUntil)
      poseWorker(golfer.body, seconds, seat % 2 ? 'wave' : 'hero');
    else poseWorker(golfer.body, seconds, 'still');

    const rig = golfer.body.userData as {
      body?: T.Group;
      armL?: T.Group;
      armR?: T.Group;
      legL?: T.Group;
      legR?: T.Group;
    };
    golfer.putter.visible = mode !== 'celebrate' && now >= golfer.cheerUntil;
    golfer.putter.rotation.set(-0.16, 0, -0.08);

    if (mode === 'ready' || mode === 'watch') {
      rig.armL?.rotation.set(-0.82, 0.18, 0.25);
      rig.armR?.rotation.set(-0.82, -0.18, -0.25);
      if (rig.body) rig.body.rotation.x = mode === 'ready' ? 0.11 : 0;
    } else if (mode === 'swing') {
      const duration = Math.max(1, golfer.swingUntil - golfer.swingAt);
      const progress = Math.min(1, (now - golfer.swingAt) / duration);
      const arc = progress < 0.34 ? -progress / 0.34 : (progress - 0.34) / 0.66;
      const swing = progress < 0.34 ? -0.62 * arc : -0.62 + arc * 1.18;
      golfer.putter.rotation.x = swing;
      rig.armL?.rotation.set(-1.08 + swing * 0.35, 0.2, 0.2);
      rig.armR?.rotation.set(-1.08 + swing * 0.35, -0.2, -0.2);
      if (rig.body) {
        rig.body.rotation.x = 0.12;
        rig.body.rotation.y = swing * 0.16;
      }
    }
  }

  private create(player: CoursePlayer, signature: string): Golfer {
    const root = new T.Group();
    root.name = `golfer-${player.id}`;
    const body = dressedGameAvatar(
      player.seat,
      { overalls: CLOTH.navy, boots: CLOTH.white },
      player.id === this.local ? getEquippedLook() : undefined,
    ).model;
    body.scale.setScalar(0.76);
    body.castShadow = true;
    root.add(body);

    const shadow = new T.Mesh(
      new T.CircleGeometry(0.42, 18),
      new T.MeshBasicMaterial({
        color: '#17354a',
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    root.add(shadow);

    const marker = new T.Mesh(
      new T.RingGeometry(0.46, 0.53, 22),
      new T.MeshBasicMaterial({
        color: SEAT_KITS[player.seat],
        transparent: true,
        opacity: player.id === this.local ? 0.82 : 0.44,
        side: T.DoubleSide,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.018;
    root.add(marker);

    const putter = this.createPutter(player.seat);
    root.add(putter);
    return {
      root,
      body,
      putter,
      marker,
      signature,
      swingAt: 0,
      swingUntil: 0,
      cheerUntil: 0,
    };
  }

  private createPutter(seat: number) {
    const putter = new T.Group();
    putter.name = 'putter';
    putter.position.set(0.31, 0.94, 0.18);
    const shaft = new T.Mesh(
      new T.CylinderGeometry(0.018, 0.018, 1.02, 8),
      new T.MeshStandardMaterial({
        color: '#d9e2e5',
        roughness: 0.32,
        metalness: 0.55,
      }),
    );
    shaft.position.y = -0.49;
    const grip = new T.Mesh(
      new T.CylinderGeometry(0.032, 0.032, 0.24, 8),
      new T.MeshStandardMaterial({ color: SEAT_KITS[seat], roughness: 0.72 }),
    );
    grip.position.y = -0.02;
    const head = new T.Mesh(
      new T.BoxGeometry(0.28, 0.075, 0.11),
      new T.MeshStandardMaterial({
        color: '#17354a',
        roughness: 0.5,
        metalness: 0.2,
      }),
    );
    head.position.set(0.08, -0.99, 0.03);
    putter.add(shaft, grip, head);
    putter.traverse((object) => {
      if (object instanceof T.Mesh) object.castShadow = true;
    });
    return putter;
  }

  private remove(id: string, golfer: Golfer) {
    this.root.remove(golfer.root);
    disposeObject(golfer.root);
    this.golfers.delete(id);
  }

  reset() {
    for (const [id, golfer] of this.golfers) this.remove(id, golfer);
  }

  dispose() {
    this.unsubscribe();
    this.reset();
    this.events.reset();
  }
}
