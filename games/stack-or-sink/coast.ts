import * as T from 'three';
import { FLOOR } from './geometry';

const SEGMENTS = 96;
const LEVELS = [FLOOR, -0.12, -0.75, -2.2];
const COLORS = ['#e8d5a0', '#dfca92', '#bba77b', '#718f83'];

// The flat center covers the existing collision floor. Only the beach outside
// the salvage boundary slopes down, so stacks and player footing still agree.
export function beachRadii(angle: number) {
  const c = Math.abs(Math.cos(angle)),
    s = Math.abs(Math.sin(angle));
  const inner = 10.55 / Math.max(c, s);
  const outline = 12.1 / Math.pow(c ** 5 + s ** 5, 0.2);
  const uneven = Math.sin(angle * 3 + 0.7) * 0.4 + Math.sin(angle * 7) * 0.2;
  const dry = Math.max(inner + 0.55, outline + uneven);
  return [inner, dry, dry + 1.25 + Math.sin(angle * 5) * 0.25, dry + 3.5];
}

export function shorelineRadius(angle: number, level: number) {
  const radii = beachRadii(angle);
  for (let i = 0; i < LEVELS.length - 1; i++) {
    if (level >= LEVELS[i + 1]) {
      const t = T.MathUtils.clamp(
        (LEVELS[i] - level) / (LEVELS[i] - LEVELS[i + 1]),
        0,
        1,
      );
      return T.MathUtils.lerp(radii[i], radii[i + 1], t);
    }
  }
  return radii[radii.length - 1];
}

function coastalMaterial(color: string) {
  const material = new T.MeshStandardMaterial({
    color,
    roughness: 0.94,
    flatShading: true,
  });
  material.userData.coastal = true;
  return material;
}

function terrain() {
  const positions = [0, FLOOR, 0],
    colors: number[] = [],
    indices: number[] = [];
  const color = new T.Color(COLORS[0]);
  colors.push(color.r, color.g, color.b);
  for (let ring = 0; ring < LEVELS.length; ring++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const angle = (i / SEGMENTS) * Math.PI * 2,
        radius = beachRadii(angle)[ring];
      positions.push(
        Math.cos(angle) * radius,
        LEVELS[ring],
        Math.sin(angle) * radius,
      );
      color
        .set(COLORS[ring])
        .multiplyScalar(1 + Math.sin(i * 2.3 + ring) * 0.022);
      colors.push(color.r, color.g, color.b);
      const a = 1 + ring * SEGMENTS + i,
        b = 1 + ring * SEGMENTS + ((i + 1) % SEGMENTS);
      if (!ring) indices.push(0, b, a);
      else indices.push(a - SEGMENTS, b, a, a - SEGMENTS, b - SEGMENTS, b);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = coastalMaterial('#ffffff');
  material.vertexColors = true;
  const mesh = new T.Mesh(geometry, material);
  mesh.receiveShadow = true;
  // Raycasts may aim at the visible beach; authoritative placement still
  // explains the salvage-yard limit when the selected point is outside it.
  mesh.userData.surface = true;
  return mesh;
}

function palm(materials: T.MeshStandardMaterial[], height: number) {
  const group = new T.Group();
  const points = Array.from({ length: 6 }, (_, i) => {
    const t = i / 5;
    return new T.Vector3(0.6 * t * t, height * t, 0.2 * t);
  });
  const trunk = new T.Mesh(
    new T.TubeGeometry(new T.CatmullRomCurve3(points), 6, 0.14, 6, false),
    materials[0],
  );
  trunk.castShadow = true;
  group.add(trunk);
  const crown = points[5];
  for (let leaf = 0; leaf < 7; leaf++) {
    const angle = (leaf * Math.PI * 2) / 7,
      length = 1.9 + (leaf % 3) * 0.2;
    const positions: number[] = [],
      indices: number[] = [];
    for (let step = 0; step < 5; step++) {
      const t = step / 4,
        distance = length * t,
        width = Math.sin(t * Math.PI) * 0.38 + 0.012;
      for (const side of [-1, 1])
        positions.push(
          crown.x + Math.cos(angle) * distance + Math.sin(angle) * width * side,
          crown.y + Math.sin(t * Math.PI) * 0.45 - t * t * 0.7,
          crown.z + Math.sin(angle) * distance - Math.cos(angle) * width * side,
        );
      if (step < 4) {
        const n = step * 2;
        indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      'position',
      new T.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const frond = new T.Mesh(geometry, materials[1 + (leaf % 2)]);
    frond.castShadow = true;
    group.add(frond);
  }
  return group;
}

export function islandCoast() {
  const group = new T.Group();
  group.name = 'Sandy island and coastal scenery';
  group.add(terrain());
  const stone = coastalMaterial('#8f9988'),
    lightStone = coastalMaterial('#c1c0a6');
  const trunk = coastalMaterial('#a48351'),
    leaves = coastalMaterial('#50886a'),
    lightLeaves = coastalMaterial('#79a765');
  leaves.side = lightLeaves.side = T.DoubleSide;
  const grass = coastalMaterial('#92a574'),
    ropeMaterial = coastalMaterial('#cab98c'),
    wood = coastalMaterial('#98805a');

  // Rounded rocks and grass sit beyond the playable floor, not in stack paths.
  for (let i = 0; i < 22; i++) {
    const angle = i * 2.399 + 0.15,
      radius = shorelineRadius(angle, -0.2) + 0.25;
    const rock = new T.Mesh(
      new T.DodecahedronGeometry(1, 0),
      i % 3 ? stone : lightStone,
    );
    rock.position.set(
      Math.cos(angle) * radius,
      -0.38,
      Math.sin(angle) * radius,
    );
    rock.scale.set(
      0.45 + (i % 3) * 0.24,
      0.45 + (i % 4) * 0.15,
      0.55 + (i % 2) * 0.3,
    );
    rock.rotation.set(i * 0.4, i * 0.7, 0.2);
    rock.castShadow = rock.receiveShadow = true;
    group.add(rock);
  }
  for (const [x, z, height, turn] of [
    [-11.1, -5.3, 4.6, 0.3],
    [10.9, 4.2, 4.2, 2.3],
    [-7.5, 11.2, 3.4, -1],
  ]) {
    const tree = palm([trunk, leaves, lightLeaves], height);
    tree.position.set(x, -0.03, z);
    tree.rotation.y = turn;
    group.add(tree);
  }
  for (let i = 0; i < 28; i++) {
    const angle = i * 2.399,
      radius = beachRadii(angle)[0] + 0.22;
    const tuft = new T.Mesh(
      new T.ConeGeometry(0.2, 0.5 + (i % 3) * 0.1, 4),
      grass,
    );
    tuft.position.set(Math.cos(angle) * radius, 0.16, Math.sin(angle) * radius);
    tuft.rotation.z = Math.sin(i) * 0.2;
    group.add(tuft);
  }

  // A light rope marks the established build boundary against the beach.
  for (const axis of [0, 1])
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const along = -10 + i * 2.5,
          x = axis ? side * 10.05 : along,
          z = axis ? along : side * 10.05;
        const post = new T.Mesh(
          new T.CylinderGeometry(0.065, 0.095, 0.76, 6),
          wood,
        );
        post.position.set(x, 0.42, z);
        post.castShadow = true;
        group.add(post);
        if (i === 8) continue;
        const endX = axis ? x : x + 2.5,
          endZ = axis ? z + 2.5 : z;
        const curve = new T.QuadraticBezierCurve3(
          new T.Vector3(x, 0.72, z),
          new T.Vector3((x + endX) / 2, 0.34, (z + endZ) / 2),
          new T.Vector3(endX, 0.72, endZ),
        );
        group.add(
          new T.Mesh(
            new T.TubeGeometry(curve, 5, 0.025, 4, false),
            ropeMaterial,
          ),
        );
      }
    }

  // A few distant islets establish open sea without enclosing the camera.
  for (const [x, z, scale] of [
    [-31, -18, 1],
    [24, -32, 0.8],
    [35, 18, 0.65],
  ]) {
    const islet = new T.Mesh(
      new T.CylinderGeometry(3.5 * scale, 5 * scale, 2, 9),
      coastalMaterial('#c1bd8e'),
    );
    islet.position.set(x, -0.85, z);
    islet.rotation.y = x;
    islet.receiveShadow = true;
    group.add(islet);
    const tree = palm([trunk, leaves, lightLeaves], 3.9 * scale);
    tree.position.set(x, 0.15, z);
    tree.scale.setScalar(scale);
    group.add(tree);
  }

  const gauge = new T.Group();
  gauge.position.set(10.5, 0, 8);
  for (let i = 0; i < 12; i++) {
    const band = new T.Mesh(
      new T.BoxGeometry(0.18, 0.3, 0.18),
      i % 2 ? lightStone : wood,
    );
    band.position.y = i * 0.3 + 0.15;
    gauge.add(band);
  }
  group.add(gauge);
  return group;
}

export class IslandSea extends T.Group {
  surface: T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
  foam: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>;
  positions = new Float32Array(SEGMENTS * 2 * 2 * 3);

  constructor() {
    super();
    this.name = 'Rising island sea';
    const material = new T.ShaderMaterial({
      transparent: true,
      uniforms: {
        time: { value: 0 },
        level: { value: -0.4 },
        shallow: { value: new T.Color('#72c7ba') },
        deep: { value: new T.Color('#398c9b') },
        horizon: { value: new T.Color('#b5d4ca') },
      },
      vertexShader: `
        uniform float time;
        varying vec2 seaPoint;
        void main() {
          vec3 p = position;
          seaPoint = p.xy;
          p.z += sin(p.x * .42 + time * .65) * cos(p.y * .31 - time * .4) * .018;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float level;
        uniform vec3 shallow;
        uniform vec3 deep;
        uniform vec3 horizon;
        varying vec2 seaPoint;
        void main() {
          float distanceFromIsland = length(seaPoint * vec2(1.0, .96));
          float shelf = 1.0 - smoothstep(13.0, 23.0, distanceFromIsland);
          shelf *= 1.0 - smoothstep(0.0, 4.0, level) * .65;
          vec3 color = mix(deep, shallow, shelf);
          float swell = sin(seaPoint.x * .48 + seaPoint.y * .32 + time * .5);
          float ripple = sin(seaPoint.x * .85 - seaPoint.y * 1.7 + sin(seaPoint.y * .4) + time * .65);
          float glint = pow(max(0.0, ripple * sin(seaPoint.y * 2.5 - time * .45)), 16.0);
          color += swell * .014 + glint * .09;
          color = mix(color, horizon, smoothstep(40.0, 100.0, distanceFromIsland));
          gl_FragColor = vec4(color, .92);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    material.userData.coastal = true;
    this.surface = new T.Mesh(new T.PlaneGeometry(250, 250, 64, 64), material);
    this.surface.rotation.x = -Math.PI / 2;
    this.add(this.surface);

    const geometry = new T.BufferGeometry(),
      indices: number[] = [];
    geometry.setAttribute(
      'position',
      new T.BufferAttribute(this.positions, 3).setUsage(T.DynamicDrawUsage),
    );
    for (let band = 0; band < 2; band++)
      for (let i = 0; i < SEGMENTS; i++) {
        if ((i + band * 4) % 13 > 9) continue;
        const a = (band * SEGMENTS + i) * 2,
          b = (band * SEGMENTS + ((i + 1) % SEGMENTS)) * 2;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    geometry.setIndex(indices);
    const foamMaterial = new T.MeshBasicMaterial({
      color: '#edf3d6',
      side: T.DoubleSide,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    foamMaterial.userData.coastal = true;
    this.foam = new T.Mesh(geometry, foamMaterial);
    this.foam.frustumCulled = false;
    this.add(this.foam);
    this.update(-0.4, 0, true);
  }

  update(level: number, time: number, reducedMotion: boolean) {
    const motion = reducedMotion ? 0 : time;
    this.surface.position.y = level;
    this.surface.material.uniforms.time.value = motion;
    this.surface.material.uniforms.level.value = level;
    this.foam.visible = level < FLOOR && level > LEVELS[LEVELS.length - 1];
    if (!this.foam.visible) return;
    this.foam.position.y = level + 0.035;
    this.foam.material.opacity = 0.5 + Math.sin(motion * 0.7) * 0.08;
    for (let band = 0; band < 2; band++)
      for (let i = 0; i < SEGMENTS; i++) {
        const angle = (i / SEGMENTS) * Math.PI * 2;
        const ripple = 0.07 * Math.sin(motion * 0.8 + angle * 5);
        const radius =
          shorelineRadius(angle, level) + 0.09 + band * 0.46 + ripple;
        const width = 0.1 + (Math.sin(angle * 9 + band) + 1) * 0.045;
        for (let edge = 0; edge < 2; edge++) {
          const n = ((band * SEGMENTS + i) * 2 + edge) * 3,
            r = radius + edge * width;
          this.positions[n] = Math.cos(angle) * r;
          this.positions[n + 1] = 0;
          this.positions[n + 2] = Math.sin(angle) * r;
        }
      }
    this.foam.geometry.attributes.position.needsUpdate = true;
  }
}

export function disposeCoastalMaterials(root: T.Object3D) {
  const materials = new Set<T.Material>();
  root.traverse((object) => {
    if (object instanceof T.Mesh)
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        if (material.userData.coastal) materials.add(material);
      }
  });
  for (const material of materials) material.dispose();
}
