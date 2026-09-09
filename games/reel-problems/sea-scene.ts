import * as THREE from 'three';
import { createJellyfish, createShark } from './models';
import type { ReelWorld } from './types';

/** Fixed buffers keep storm effects cheap on touch devices. */
export class SeaScene {
  private rain = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: '#d4e9ef',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  private streaks = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: '#e6f9ef',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  private lightning: THREE.Mesh;
  private visitors = new Map<string, THREE.Group>();
  private sky = new THREE.Color('#cee4d5');
  private calmSky = new THREE.Color('#cee4d5');
  private stormSky = new THREE.Color('#536b85');
  private calmWater = new THREE.Color('#5baeb0');
  private stormWater = new THREE.Color('#315c7c');
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    .matches;

  constructor(
    private scene: THREE.Scene,
    private sun: THREE.DirectionalLight,
    private water: THREE.MeshStandardMaterial,
  ) {
    this.rain.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(360 * 6), 3),
    );
    this.streaks.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(40 * 6), 3),
    );
    this.rain.frustumCulled = this.streaks.frustumCulled = false;
    const path = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 17, 0),
        new THREE.Vector3(-0.6, 12, 0.2),
        new THREE.Vector3(0.8, 9, 0),
        new THREE.Vector3(-0.3, 6, 0.2),
        new THREE.Vector3(0.5, 4, 0),
        new THREE.Vector3(0, 0.2, 0),
      ],
      false,
      'centripetal',
    );
    this.lightning = new THREE.Mesh(
      new THREE.TubeGeometry(path, 20, 0.08, 5, false),
      new THREE.MeshBasicMaterial({ color: '#fff6cf', transparent: true }),
    );
    this.lightning.visible = false;
    scene.background = this.sky;
    scene.add(this.rain, this.streaks, this.lightning);
  }

  update(w: ReelWorld, time: number) {
    const weather = w.weather;
    if (!weather) return;
    const dark = Math.min(1, weather.rain * 0.78 + weather.gust * 0.2);
    this.sky.copy(this.calmSky).lerp(this.stormSky, dark);
    this.scene.fog?.color.copy(this.sky);
    this.water.color.copy(this.calmWater).lerp(this.stormWater, dark);
    const flash = Math.max(
      0,
      Math.min(1, (weather.flashUntil - w.clock) / 450),
    );
    this.sun.intensity =
      3.2 - dark * 2 + (this.reducedMotion ? 0 : flash * 0.8);
    this.lightning.visible = flash > 0 && !this.reducedMotion;
    this.lightning.position.set(weather.lightningX, 0, weather.lightningZ);
    (this.lightning.material as THREE.MeshBasicMaterial).opacity = flash;
    this.rain.visible = weather.rain > 0.02;
    this.rain.material.opacity = weather.rain * 0.5;
    const drops = this.rain.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    const t = time / 1000;
    for (let i = 0; i < 360 && this.rain.visible; i++) {
      const height = (((i * 2.31 - t * 17) % 18) + 18) % 18;
      const x =
        w.boat.x +
        Math.sin(i * 78.23) * 23 +
        (18 - height) * weather.windX * 0.035;
      const z =
        w.boat.z +
        Math.cos(i * 39.17) * 23 +
        (18 - height) * weather.windZ * 0.035;
      drops.setXYZ(i * 2, x, height, z);
      drops.setXYZ(
        i * 2 + 1,
        x + weather.windX * 0.035,
        height - 0.9,
        z + weather.windZ * 0.035,
      );
    }
    drops.needsUpdate = this.rain.visible;
    this.streaks.visible = weather.gust > 0.08;
    this.streaks.material.opacity = weather.gust * 0.6;
    const strokes = this.streaks.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    for (let i = 0; i < 40 && this.streaks.visible; i++) {
      const travel = ((t * (3 + weather.gust * 5) + i * 3.1) % 40) - 20;
      const side = Math.sin(i * 17.1) * 20;
      const x =
        w.boat.x +
        Math.sin(weather.direction) * travel +
        Math.cos(weather.direction) * side;
      const z =
        w.boat.z +
        Math.cos(weather.direction) * travel -
        Math.sin(weather.direction) * side;
      strokes.setXYZ(i * 2, x, 0.11 + (i % 4) * 0.025, z);
      strokes.setXYZ(
        i * 2 + 1,
        x + Math.sin(weather.direction) * 2.8,
        0.11,
        z + Math.cos(weather.direction) * 2.8,
      );
    }
    strokes.needsUpdate = this.streaks.visible;
    const active = new Set(
      w.wildlife.filter((v) => v.activeUntil > w.clock).map((v) => v.id),
    );
    for (const [id, object] of this.visitors) object.visible = active.has(id);
    for (const visitor of w.wildlife) {
      if (!active.has(visitor.id)) continue;
      let object = this.visitors.get(visitor.id);
      if (!object) {
        object = visitor.kind === 'shark' ? createShark() : createJellyfish();
        this.visitors.set(visitor.id, object);
        this.scene.add(object);
      }
      object.visible = true;
      object.position.set(
        visitor.x,
        0.12 + Math.sin(t * 3 + visitor.x) * 0.06,
        visitor.z,
      );
      object.rotation.y = visitor.angle;
      if (visitor.kind === 'jellyfish')
        object.scale.setScalar(1 + Math.sin(t * 4 + visitor.z) * 0.09);
      else object.rotation.z = Math.sin(t * 5) * 0.035;
    }
  }
}
