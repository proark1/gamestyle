import * as T from 'three';
import { disposeObject } from '../../../shared/rendering/dispose-object';
import { LOOK_STYLES } from './styles';
import type { LookStyleId } from './types';

export type WaterDensity = {
  surfaceSegments: number;
  shorelineSegments: number;
  contactFoam: number;
};

export type WaterMotion = {
  amplitude: number;
  speed: number;
};

export const WATER_DENSITY: Record<'desktop' | 'touch', WaterDensity> = {
  desktop: {
    surfaceSegments: 92,
    shorelineSegments: 112,
    contactFoam: 38,
  },
  touch: {
    surfaceSegments: 52,
    shorelineSegments: 62,
    contactFoam: 20,
  },
};

const STYLE_WATER = {
  storybook: {
    amplitude: 0.48,
    speed: 0.7,
    ridgeStrength: 0.36,
    ridgeWidth: 0.76,
    foamOpacity: 0.66,
    graphic: 0,
  },
  stormlight: {
    amplitude: 0.64,
    speed: 1.08,
    ridgeStrength: 0.52,
    ridgeWidth: 0.58,
    foamOpacity: 0.5,
    graphic: 0,
  },
  graphic: {
    amplitude: 0.27,
    speed: 0.82,
    ridgeStrength: 0.62,
    ridgeWidth: 0.7,
    foamOpacity: 0.9,
    graphic: 1,
  },
} as const;

export function waterDensity(touch: boolean): WaterDensity {
  return WATER_DENSITY[touch ? 'touch' : 'desktop'];
}

export function waterMotion(
  style: LookStyleId,
  reducedMotion: boolean,
): WaterMotion {
  const water = STYLE_WATER[style];
  return reducedMotion
    ? { amplitude: water.amplitude * 0.2, speed: water.speed * 0.24 }
    : { amplitude: water.amplitude, speed: water.speed };
}

export function fishGlowFromDepth(depth: number) {
  return Math.max(0, Math.min(1, 1.08 - Math.max(0, depth) * 0.28));
}

function seeded(index: number) {
  const value = Math.sin(index * 71.173 + 9.177) * 43758.5453;
  return value - Math.floor(value);
}

function waveAt(x: number, z: number, seconds: number, motion: WaterMotion) {
  const phase1 = (x * 0.92 + z * 0.38) * 0.255 + seconds * motion.speed;
  const phase2 = (x * -0.32 + z * 0.95) * 0.39 - seconds * motion.speed * 0.73;
  const phase3 = (x * 0.68 + z * -0.74) * 0.17 + seconds * motion.speed * 0.44;
  const roundWave = (phase: number) => {
    const wave = Math.sin(phase);
    return wave * 0.72 + Math.max(0, wave) ** 2 * 0.28;
  };
  return (
    roundWave(phase1) * motion.amplitude * 0.58 +
    roundWave(phase2) * motion.amplitude * 0.28 +
    roundWave(phase3) * motion.amplitude * 0.14
  );
}

function sculptedMaterial() {
  return new T.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      amplitude: { value: STYLE_WATER.storybook.amplitude },
      speed: { value: STYLE_WATER.storybook.speed },
      shallow: { value: new T.Color('#4d928d') },
      deep: { value: new T.Color('#245d65') },
      foam: { value: new T.Color('#e9f3dc') },
      fishColor: { value: new T.Color('#79edcf') },
      fishPosition: { value: new T.Vector2() },
      fishGlow: { value: 0.7 },
      ridgeStrength: { value: STYLE_WATER.storybook.ridgeStrength },
      ridgeWidth: { value: STYLE_WATER.storybook.ridgeWidth },
      graphic: { value: 0 },
    },
    vertexShader: `
      uniform float time;
      uniform float amplitude;
      uniform float speed;
      varying float vHeight;
      varying float vCrest;
      varying vec3 vNormalWorld;
      varying vec3 vWorld;

      float roundedWave(float phase) {
        float wave = sin(phase);
        return wave * .72 + pow(max(wave, 0.0), 2.0) * .28;
      }

      float waveHeight(vec2 point) {
        float p1 = dot(point, normalize(vec2(.92, .38))) * .255 + time * speed;
        float p2 = dot(point, normalize(vec2(-.32, .95))) * .39 - time * speed * .73;
        float p3 = dot(point, normalize(vec2(.68, -.74))) * .17 + time * speed * .44;
        return roundedWave(p1) * amplitude * .58
          + roundedWave(p2) * amplitude * .28
          + roundedWave(p3) * amplitude * .14;
      }

      void main() {
        vec3 p = position;
        float height = waveHeight(p.xz);
        float epsilon = .16;
        float right = waveHeight(p.xz + vec2(epsilon, 0.0));
        float ahead = waveHeight(p.xz + vec2(0.0, epsilon));
        vec3 shapedNormal = normalize(vec3(height - right, epsilon, height - ahead));
        p.y += height;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vHeight = height;
        vCrest = smoothstep(amplitude * .28, amplitude * .82, height);
        vNormalWorld = normalize(mat3(modelMatrix) * shapedNormal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float amplitude;
      uniform vec3 shallow;
      uniform vec3 deep;
      uniform vec3 foam;
      uniform vec3 fishColor;
      uniform vec2 fishPosition;
      uniform float fishGlow;
      uniform float ridgeStrength;
      uniform float ridgeWidth;
      uniform float graphic;
      varying float vHeight;
      varying float vCrest;
      varying vec3 vNormalWorld;
      varying vec3 vWorld;

      void main() {
        vec3 normal = normalize(vNormalWorld);
        vec3 viewDirection = normalize(cameraPosition - vWorld);
        vec3 lightDirection = normalize(vec3(-.45, .88, .32));
        float light = max(0.0, dot(normal, lightDirection));
        float fresnel = pow(1.0 - max(0.0, dot(normal, viewDirection)), 2.1);
        float shaped = smoothstep(-amplitude, amplitude, vHeight);
        if (graphic > .5) shaped = floor(shaped * 3.0) / 3.0;
        float clayLight = smoothstep(.08, .88, light);
        float slope = clamp((1.0 - normal.y) * 2.7, 0.0, 1.0);
        vec3 color = mix(deep, shallow, .26 + shaped * .62);
        color *= .66 + clayLight * .48;
        color = mix(color, deep * .82, slope * (1.0 - clayLight) * .32);
        color = mix(color, shallow * 1.18, fresnel * .26);

        float shoulder = smoothstep(.4, .78, vCrest);
        color = mix(color, shallow * 1.12, shoulder * .14);

        vec3 halfDirection = normalize(lightDirection + viewDirection);
        float claySheen = pow(max(0.0, dot(normal, halfDirection)), 18.0);
        color += foam * claySheen * .16;

        float ridge = smoothstep(ridgeWidth, 1.0, vCrest);
        float breakup = sin(vWorld.x * .63 + sin(vWorld.z * .38) * 1.7) * .5 + .5;
        ridge *= mix(.36, 1.0, smoothstep(.18, .82, breakup));
        color = mix(color, foam, ridge * ridgeStrength);

        float fishDistance = distance(vWorld.xz, fishPosition);
        float fishShape = exp(-fishDistance * fishDistance * .045) * fishGlow;
        float brokenGlow = fishShape * (.45 + ridge * .75 + light * .16);
        color = mix(color, fishColor, clamp(brokenGlow, 0.0, .72));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: T.DoubleSide,
  });
}

function blobGeometry(seed: number) {
  const shape = new T.Shape();
  const points = 12;
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const radius = 0.78 + seeded(seed * 17 + i) * 0.34;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new T.ShapeGeometry(shape, 4);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function irregularRing(radius: number, segments: number, seed: number) {
  const points: T.Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const ripple =
      Math.sin(angle * 3 + seed) * 0.17 +
      Math.sin(angle * 7 - seed * 0.8) * 0.08;
    const localRadius = radius + ripple;
    points.push(
      new T.Vector3(
        Math.cos(angle) * localRadius,
        0,
        -1 + Math.sin(angle) * localRadius * 0.93,
      ),
    );
  }
  return new T.CatmullRomCurve3(points, true, 'catmullrom', 0.35);
}

type FoamPiece = {
  mesh: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>;
  phase: number;
  baseScale: T.Vector3;
};

export type SculptedWater = ReturnType<typeof createSculptedWater>;

export function createSculptedWater(touch: boolean) {
  const density = waterDensity(touch);
  const group = new T.Group();
  group.name = 'sculpted-storybook-water';
  let style: LookStyleId = 'storybook';
  let reducedMotion = false;
  let motion = waterMotion(style, reducedMotion);
  let seconds = 0;

  const geometry = new T.PlaneGeometry(
    180,
    180,
    density.surfaceSegments,
    density.surfaceSegments,
  );
  geometry.rotateX(-Math.PI / 2);
  const material = sculptedMaterial();
  const surface = new T.Mesh(geometry, material);
  surface.position.y = -0.68;
  surface.receiveShadow = true;
  surface.renderOrder = -2;
  group.add(surface);

  const foamMaterial = new T.MeshBasicMaterial({
    color: LOOK_STYLES.storybook.palette.foam,
    transparent: true,
    opacity: STYLE_WATER.storybook.foamOpacity,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const wetMaterial = new T.MeshStandardMaterial({
    color: '#204f56',
    roughness: 0.46,
    transparent: true,
    opacity: 0.72,
  });

  const ribbons: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>[] = [];
  for (let i = 0; i < 2; i++) {
    const ribbon = new T.Mesh(
      new T.TubeGeometry(
        irregularRing(13.05 + i * 0.2, density.shorelineSegments, i + 2),
        density.shorelineSegments,
        0.024 + i * 0.009,
        5,
        true,
      ),
      foamMaterial,
    );
    ribbon.position.y = -0.47 + i * 0.012;
    ribbon.userData.phase = i * 2.13;
    ribbon.renderOrder = 3;
    group.add(ribbon);
    ribbons.push(ribbon);
  }

  const wetShore = new T.Mesh(
    new T.TubeGeometry(
      irregularRing(12.82, density.shorelineSegments, 9),
      density.shorelineSegments,
      0.18,
      7,
      true,
    ),
    wetMaterial,
  );
  wetShore.position.y = -0.58;
  wetShore.scale.y = 2.2;
  group.add(wetShore);

  const contactLocations: [number, number, number, number][] = [];
  for (let i = 0; i < density.contactFoam; i++) {
    const angle = (i / density.contactFoam) * Math.PI * 2;
    const radius = 12.9 + Math.sin(i * 2.3) * 0.28;
    contactLocations.push([
      Math.cos(angle) * radius,
      -1 + Math.sin(angle) * radius * 0.93,
      0.32 + seeded(i) * 0.55,
      0.1 + seeded(i + 31) * 0.22,
    ]);
  }
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++)
      contactLocations.push([side * 2.08, 7.2 + i * 2.05, 0.42, 0.12]);
  contactLocations.push(
    [-9.7, 9.1, 1.05, 0.18],
    [-4.7, 9.1, 1.05, 0.18],
    [-7.2, 7.6, 0.55, 0.16],
    [-7.2, 10.8, 0.55, 0.16],
  );

  const foamPieces: FoamPiece[] = [];
  for (let i = 0; i < contactLocations.length; i++) {
    const [x, z, sx, sz] = contactLocations[i];
    const mesh = new T.Mesh(blobGeometry(i + 3), foamMaterial);
    const scale = new T.Vector3(sx, 1, sz);
    mesh.scale.copy(scale);
    mesh.position.set(x, -0.47, z);
    mesh.rotation.y = seeded(i + 90) * Math.PI;
    mesh.renderOrder = 4;
    group.add(mesh);
    foamPieces.push({
      mesh,
      phase: seeded(i + 130) * Math.PI * 2,
      baseScale: scale,
    });
  }

  const wetPosts: T.Mesh[] = [];
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) {
      const band = new T.Mesh(
        new T.CylinderGeometry(0.215, 0.225, 0.4, 10, 1, true),
        wetMaterial,
      );
      band.position.set(side * 2.08, -0.48, 7.2 + i * 2.05);
      group.add(band);
      wetPosts.push(band);
    }

  const fishPosition = new T.Vector3();

  const applyStyle = (next: LookStyleId) => {
    style = next;
    const look = LOOK_STYLES[next];
    const tuning = STYLE_WATER[next];
    motion = waterMotion(style, reducedMotion);
    material.uniforms.amplitude.value = motion.amplitude;
    material.uniforms.speed.value = motion.speed;
    material.uniforms.shallow.value.set(look.palette.sea);
    material.uniforms.deep.value.set(look.palette.seaDeep);
    material.uniforms.foam.value.set(look.palette.foam);
    material.uniforms.fishColor.value.set(look.palette.fish);
    material.uniforms.ridgeStrength.value = tuning.ridgeStrength;
    material.uniforms.ridgeWidth.value = tuning.ridgeWidth;
    material.uniforms.graphic.value = tuning.graphic;
    foamMaterial.color.set(look.palette.foam);
    foamMaterial.opacity = tuning.foamOpacity;
    wetMaterial.color.set(next === 'stormlight' ? '#142f38' : '#245b5e');
    wetMaterial.opacity = next === 'graphic' ? 0.86 : 0.7;
  };

  const setReducedMotion = (reduced: boolean) => {
    reducedMotion = reduced;
    applyStyle(style);
  };

  const setFish = (position: T.Vector3, depth: number) => {
    fishPosition.copy(position);
    material.uniforms.fishPosition.value.set(position.x, position.z);
    material.uniforms.fishGlow.value = fishGlowFromDepth(depth);
  };

  const update = (nextSeconds: number) => {
    seconds = nextSeconds;
    material.uniforms.time.value = seconds;
    for (let i = 0; i < ribbons.length; i++) {
      const ribbon = ribbons[i];
      const pulse = reducedMotion
        ? 1
        : 1 + Math.sin(seconds * 0.48 + Number(ribbon.userData.phase)) * 0.008;
      ribbon.scale.set(pulse, 1, pulse);
      ribbon.position.y =
        -0.48 + waveAt(7 + i * 3, -4 - i, seconds, motion) * 0.34 + i * 0.012;
    }
    for (const piece of foamPieces) {
      const pulse = reducedMotion
        ? 1
        : 1 + Math.sin(seconds * 0.72 + piece.phase) * 0.12;
      piece.mesh.scale.set(
        piece.baseScale.x * pulse,
        1,
        piece.baseScale.z * (2 - pulse),
      );
      piece.mesh.position.y =
        -0.65 +
        waveAt(piece.mesh.position.x, piece.mesh.position.z, seconds, motion) +
        0.035;
      piece.mesh.rotation.y += reducedMotion ? 0 : 0.00045;
    }
    for (const post of wetPosts) {
      post.position.y =
        -0.56 +
        waveAt(post.position.x, post.position.z, seconds, motion) * 0.18;
    }
  };

  const dispose = () => {
    disposeObject(group);
    material.dispose();
    foamMaterial.dispose();
    wetMaterial.dispose();
  };

  applyStyle('storybook');

  return {
    group,
    setStyle: applyStyle,
    setReducedMotion,
    setFish,
    update,
    dispose,
  };
}
