import * as T from 'three';
import { REDUCED_MOTION_QUERY } from '../../shared/browser/device';
import { createRenderer } from '../../shared/rendering/create-renderer';
import {
  addHouseLight,
  HOUSE_EXPOSURE,
  SKY,
} from '../../shared/rendering/house-light';
import { disposeObject } from '../../shared/rendering/dispose-object';
import { shouldRenderFrame } from '../../shared/rendering/runtime';
import { getEquippedLook } from '../../shared/wardrobe/wardrobe-state';
import { TEAM } from '../../shared/rendering/palette';
import { createRing, createBoxer, poseBoxer } from './models';
import { animateCrowd } from './ringside';
import { TAG_TRANSITION } from './tagging';
import { label } from './signage';
import type { Snapshot } from './types';

export class BoxingScene {
  private scene = new T.Scene();
  private renderer: T.WebGLRenderer;
  private camera = new T.PerspectiveCamera(40, 1, 0.1, 100);
  private observer: ResizeObserver;
  private ring = createRing();
  private boxers = new Map<string, ReturnType<typeof createBoxer>>();
  private latest: Snapshot | null = null;
  private frame = 0;
  private last = 0;
  private event = 0;
  private local = 'local';
  private eventRoom = '';
  private shake = 0;
  private ripple = 0;
  private crowdExcitement = 0;
  private reduced = window.matchMedia(REDUCED_MOTION_QUERY);
  private effects: {
    mesh: T.Mesh;
    life: number;
    x: number;
    z: number;
    down: boolean;
  }[] = [];
  constructor(private host: HTMLElement) {
    this.renderer = createRenderer(host, {
      exposure: HOUSE_EXPOSURE,
      label:
        'Boxing ring. WASD move, Space punch, Shift guard, Q dodge, E tag, F corner assist.',
    }).renderer;
    const { sun } = addHouseLight(this.scene, {
      sky: SKY.hall,
      fog: { near: 35, far: 65 },
    });
    sun.shadow.camera.left = sun.shadow.camera.bottom = -13;
    sun.shadow.camera.right = sun.shadow.camera.top = 13;
    this.scene.add(this.ring.root);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.frame = requestAnimationFrame(this.loop);
  }
  setLocalPlayer(id: string) {
    this.local = id;
  }
  render(s: Snapshot) {
    this.latest = s;
    for (const p of s.world.players) {
      let rig = this.boxers.get(p.id);
      if (rig && rig.team !== p.team) {
        this.scene.remove(rig.root);
        disposeObject(rig.root);
        this.boxers.delete(p.id);
        rig = undefined;
      }
      if (!rig) {
        rig = createBoxer(
          p,
          p.id === this.local ? getEquippedLook() : undefined,
        );
        rig.root.position.set(p.x, 0.1, p.z);
        this.boxers.set(p.id, rig);
        this.scene.add(rig.root);
      }
    }
    for (const [id, rig] of this.boxers)
      if (!s.world.players.some((p) => p.id === id)) {
        this.scene.remove(rig.root);
        disposeObject(rig.root);
        this.boxers.delete(id);
      }
    // First snapshot is a baseline: old checkpoint effects must not replay on join.
    const roomKey = `${s.code}:${s.selfId}`;
    if (this.eventRoom !== roomKey) {
      this.eventRoom = roomKey;
      this.event = s.world.nextEvent;
      this.crowdExcitement = 0;
    }
    for (const e of s.world.events) {
      if (e.id <= this.event) continue;
      this.event = e.id;
      if (e.kind === 'down' || e.kind === 'bell') this.crowdExcitement = 1;
      else if (
        e.kind === 'hit' ||
        e.kind === 'tag' ||
        e.kind === 'counter' ||
        e.kind === 'parry'
      )
        this.crowdExcitement = Math.max(this.crowdExcitement, 0.45);
      if (e.kind === 'rope' || e.kind === 'launch') this.ripple = 1;
      if (
        e.kind === 'hit' ||
        e.kind === 'down' ||
        e.kind === 'block' ||
        e.kind === 'parry' ||
        e.kind === 'counter' ||
        e.kind === 'guard-break' ||
        e.kind === 'tag'
      ) {
        if (!this.reduced.matches && e.kind !== 'tag')
          this.shake = Math.min(0.12, e.strength * 0.07);
        const mesh = new T.Mesh(
          new T.TorusGeometry(e.kind === 'down' ? 0.7 : 0.22, 0.04, 4, 24),
          new T.MeshBasicMaterial({
            color:
              e.kind === 'block' || e.kind === 'parry'
                ? '#fff7db'
                : e.kind === 'tag'
                  ? TEAM[e.team]
                  : '#f7ca63',
            transparent: true,
          }),
        );
        mesh.position.set(e.x, e.kind === 'down' ? 0.18 : 1.2, e.z);
        if (e.kind === 'down') mesh.rotation.x = -Math.PI / 2;
        else mesh.lookAt(this.camera.position);
        this.scene.add(mesh);
        this.effects.push({
          mesh,
          life: 0.5,
          x: e.x,
          z: e.z,
          down: e.kind === 'down',
        });
        if (
          e.kind === 'parry' ||
          e.kind === 'counter' ||
          e.kind === 'guard-break'
        ) {
          // Short, in-world feedback ties the sound and impact to the defensive read.
          const text = label(
            e.kind === 'parry'
              ? 'PARRY'
              : e.kind === 'counter'
                ? 'COUNTER'
                : 'GUARD BREAK',
            '#f7efd9',
            e.kind === 'guard-break' ? '#a75242' : '#426a5b',
            1.6,
            0.35,
          );
          text.position.set(e.x, 2.1, e.z);
          text.material.transparent = true;
          text.lookAt(this.camera.position);
          this.scene.add(text);
          this.effects.push({
            mesh: text,
            life: 0.5,
            x: e.x,
            z: e.z,
            down: false,
          });
        }
      }
    }
    while (this.effects.length > 32) {
      const fx = this.effects.shift()!;
      this.scene.remove(fx.mesh);
      disposeObject(fx.mesh);
    }
  }
  private resize() {
    const width = Math.max(1, this.host.clientWidth),
      height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    // Fit the ring's width even in portrait; leave top and bottom room for HUD/controls.
    const distance = Math.max(19, 18 / this.camera.aspect);
    this.camera.position.set(0, distance * 0.72, distance * 0.8);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }
  private loop = (now: number) => {
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0);
    this.last = now;
    if (!shouldRenderFrame(this.renderer)) return;
    this.crowdExcitement = Math.max(0, this.crowdExcitement - dt * 0.38);
    animateCrowd(
      this.ring.crowd,
      now / 1000,
      this.crowdExcitement,
      this.reduced.matches,
    );
    const w = this.latest?.world;
    if (w)
      for (const p of w.players) {
        const rig = this.boxers.get(p.id)!;
        const distance = Math.hypot(
          p.x - rig.root.position.x,
          p.z - rig.root.position.z,
        );
        const blend = distance > 3 ? 1 : 1 - Math.exp(-dt * 22);
        rig.root.position.x += (p.x - rig.root.position.x) * blend;
        rig.root.position.z += (p.z - rig.root.position.z) * blend;
        rig.root.position.y = 0.1;
        if (p.tagTransition > 0) {
          const progress = this.reduced.matches
            ? 1
            : 1 - p.tagTransition / TAG_TRANSITION;
          const smooth = progress * progress * (3 - 2 * progress);
          rig.root.position.x = p.tagFromX + (p.x - p.tagFromX) * smooth;
          rig.root.position.z =
            p.tagFromZ +
            (p.z - p.tagFromZ) * smooth +
            (p.active ? 1 : -1) * Math.sin(progress * Math.PI) * 0.2;
          rig.root.position.y += Math.sin(progress * Math.PI) * 0.32;
        }
        const angle = Math.atan2(
          Math.sin(p.heading - rig.model.rotation.y),
          Math.cos(p.heading - rig.model.rotation.y),
        );
        const yaw = rig.model.rotation.y + angle * blend;
        poseBoxer(rig, p, now / 1000, this.reduced.matches);
        rig.model.rotation.y = yaw;
        rig.marker.visible = p.id === this.local;
        rig.marker.position.y =
          2.4 + (this.reduced.matches ? 0 : Math.sin(now / 250) * 0.06);
      }
    this.ripple = Math.max(0, this.ripple - dt * 2);
    for (const rope of this.ring.ropes) {
      const positions = rope.mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const amount = this.reduced.matches
          ? 0
          : Math.sin((Math.floor(i / 7) / 24) * Math.PI) *
            Math.sin(now / 45 + i * 0.5) *
            this.ripple *
            0.13;
        if (rope.axis === 'x') positions.setX(i, rope.rest[i * 3] + amount);
        else positions.setZ(i, rope.rest[i * 3 + 2] + amount);
      }
      positions.needsUpdate = true;
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.life -= dt;
      if (fx.life <= 0) {
        this.scene.remove(fx.mesh);
        disposeObject(fx.mesh);
        this.effects.splice(i, 1);
        continue;
      }
      fx.mesh.scale.setScalar(1 + (0.5 - fx.life) * (fx.down ? 5 : 2));
      (fx.mesh.material as T.MeshBasicMaterial).opacity = fx.life * 2;
    }
    const offset = this.reduced.matches ? 0 : Math.sin(now * 0.1) * this.shake;
    this.camera.position.x = offset;
    this.shake *= Math.exp(-dt * 12);
    this.renderer.render(this.scene, this.camera);
  };
  dispose() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
