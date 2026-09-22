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
import { createCage, createFighter, poseFighter } from './models';
import { animateCrowd } from './ringside';
import { label } from './signage';
import type { Snapshot } from './types';
export class CageScene {
  private scene = new T.Scene();
  private renderer: T.WebGLRenderer;
  private camera = new T.PerspectiveCamera(40, 1, 0.1, 120);
  private observer: ResizeObserver;
  private cage = createCage();
  private fighters = new Map<string, ReturnType<typeof createFighter>>();
  private latest: Snapshot | null = null;
  private frame = 0;
  private last = 0;
  private event = 0;
  private eventRoom = '';
  private local = 'local';
  private excitement = 0;
  private reduced = window.matchMedia(REDUCED_MOTION_QUERY);
  private effects: { mesh: T.Mesh; life: number }[] = [];
  constructor(private host: HTMLElement) {
    this.renderer = createRenderer(host, {
      exposure: HOUSE_EXPOSURE,
      label:
        'Cage Clash. WASD move, Space punch, F kick, E grapple, Shift guard, Q dodge.',
    }).renderer;
    const { sun } = addHouseLight(this.scene, {
      sky: SKY.hall,
      fog: { near: 40, far: 85 },
    });
    sun.shadow.camera.left = sun.shadow.camera.bottom = -13;
    sun.shadow.camera.right = sun.shadow.camera.top = 13;
    this.scene.add(this.cage.root);
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
    for (const p of s.world.players)
      if (!this.fighters.has(p.id)) {
        const visual = createFighter(
          p,
          p.id === this.local ? getEquippedLook() : undefined,
        );
        visual.root.position.set(p.x, 0.1, p.z);
        this.fighters.set(p.id, visual);
        this.scene.add(visual.root);
      }
    for (const [id, visual] of this.fighters)
      if (!s.world.players.some((p) => p.id === id)) {
        this.scene.remove(visual.root);
        disposeObject(visual.root);
        this.fighters.delete(id);
      }
    const key = `${s.code}:${s.selfId}`;
    if (key !== this.eventRoom) {
      this.eventRoom = key;
      this.event = s.world.nextEvent;
    }
    for (const event of s.world.events) {
      if (event.id <= this.event) continue;
      this.event = event.id;
      if (
        ['hit', 'down', 'takedown', 'bell', 'submission'].includes(event.kind)
      )
        this.excitement = 1;
      const words: Record<string, string> = {
        parry: 'PARRY',
        counter: 'COUNTER',
        'guard-break': 'GUARD BREAK',
        takedown: 'TAKEDOWN',
        escape: 'ESCAPE',
        advance: 'POSITION',
        submission: 'SUBMISSION',
        down: 'DOWN!',
      };
      if (!words[event.kind] && !['hit', 'block'].includes(event.kind))
        continue;
      const mesh = words[event.kind]
        ? label(words[event.kind], '#fff5d5', '#355f4f', 1.7, 0.36)
        : new T.Mesh(
            new T.TorusGeometry(0.2, 0.035, 4, 20),
            new T.MeshBasicMaterial({
              color: event.kind === 'block' ? '#fff7db' : '#f5c563',
              transparent: true,
            }),
          );
      mesh.position.set(event.x, words[event.kind] ? 2.3 : 1.2, event.z);
      mesh.lookAt(this.camera.position);
      this.scene.add(mesh);
      this.effects.push({ mesh, life: 0.7 });
    }
    while (this.effects.length > 24) {
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
    const distance = Math.max(17, 13 / this.camera.aspect);
    this.camera.position.set(0, distance * 0.85, distance * 0.78);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    for (const fence of this.cage.fences)
      fence.material.opacity = fence.z > 0 ? 0.1 : 0.4;
  }
  private loop = (now: number) => {
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0);
    this.last = now;
    if (!shouldRenderFrame(this.renderer)) return;
    this.excitement = Math.max(0, this.excitement - dt * 0.4);
    animateCrowd(
      this.cage.crowd,
      now / 1000,
      this.excitement,
      this.reduced.matches,
    );
    const w = this.latest?.world;
    if (w)
      for (const p of w.players) {
        const v = this.fighters.get(p.id)!;
        const blend = 1 - Math.exp(-dt * 22);
        v.root.position.x += (p.x - v.root.position.x) * blend;
        v.root.position.z += (p.z - v.root.position.z) * blend;
        poseFighter(v, p, now / 1000, this.reduced.matches, w.grapple);
        v.marker.visible = p.id === this.local;
        v.marker.position.y =
          w.grapple && w.grapple.mode !== 'clinch' ? 1.7 : 2.4;
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
      if (!this.reduced.matches) fx.mesh.position.y += dt * 0.35;
      const material = fx.mesh.material as T.MeshBasicMaterial;
      material.transparent = true;
      material.opacity = Math.min(1, fx.life * 3);
    }
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
