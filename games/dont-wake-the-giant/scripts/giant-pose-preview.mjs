// Offline geometry review; no browser or gameplay state is required.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as T from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { GiantModel } from '../giant-model.ts';
import { freshGiant } from '../simulation.ts';
import { ESCAPE } from '../types.ts';

class Element {
  childNodes = [];
  attributes = {};
  style = {};
  constructor(tag) {
    this.tag = tag;
  }
  setAttribute(key, value) {
    this.attributes[key] = value;
  }
  appendChild(child) {
    this.childNodes.push(child);
  }
  removeChild(child) {
    this.childNodes.splice(this.childNodes.indexOf(child), 1);
  }
  toString() {
    const attrs = Object.entries(this.attributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');
    return `<${this.tag} ${attrs}>${this.childNodes.join('')}</${this.tag}>`;
  }
}
globalThis.document = {
  createElementNS: (_namespace, tag) => new Element(tag),
};
const directory = resolve(
  process.env.GIANT_PREVIEW_DIR || 'outputs/giant-motion',
);
await mkdir(directory, { recursive: true });
const panels = [];
for (const [index, elapsed] of [0, 1600, 2800, 6000].entries()) {
  const world = freshGiant(100000);
  world.phase = elapsed ? 'escape' : 'playing';
  world.escapeAt = elapsed ? 100000 + ESCAPE : 0;
  world.clock = 100000 + elapsed;
  const scene = new T.Scene();
  const giant = new GiantModel(world);
  scene.add(giant, new T.AmbientLight('#ffffff', 1.2));
  const sun = new T.DirectionalLight('#ffffff', 2);
  sun.position.set(-12, 24, 18);
  scene.add(sun);
  const bed = new T.Mesh(
    new T.BoxGeometry(9.6, 0.85, 16.8),
    new T.MeshStandardMaterial({ color: '#d4c5a6' }),
  );
  bed.position.set(2, 2.175, -0.8);
  scene.add(bed);
  const camera = new T.OrthographicCamera(-11, 11, 10, -10, 0.1, 100);
  camera.position.set(20, 17, 24);
  camera.lookAt(2, 7, 0);
  const renderer = new SVGRenderer();
  renderer.setSize(700, 640);
  renderer.setPrecision(2);
  renderer.render(scene, camera);
  const root = /** @type {Element} */ (
    /** @type {unknown} */ (renderer.domElement)
  );
  const svg = root.toString();
  await writeFile(
    resolve(directory, `pose-${elapsed}.svg`),
    svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '),
  );
  panels.push(
    `<g transform="translate(${(index % 2) * 700},${Math.floor(index / 2) * 680})"><text x="24" y="32" font-size="22" fill="#253f3b">${['Sleeping', 'Sitting up / feet tucking', 'Weight forward / hands braced', 'Standing / reaching'][index]}</text><g transform="translate(350,355)">${root.childNodes.join('')}</g></g>`,
  );
}
await writeFile(
  resolve(directory, 'poses.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1360"><rect width="100%" height="100%" fill="#f5f3ef"/>${panels.join('')}</svg>`,
);
console.log(resolve(directory, 'poses.svg'));
