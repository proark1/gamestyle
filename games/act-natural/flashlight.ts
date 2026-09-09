import * as T from 'three';
import {
  FARM_COVER,
  NEAR_SIGHT,
  SIGHT_HALF_ANGLE,
  SIGHT_RANGE,
  visionBoundary,
} from './visibility';
import type { FarmWorld } from './types';

export const NIGHT = {
  sky: '#0c1628',
  moon: '#89aee7',
  ground: '#111827',
  beam: '#ffdf9b',
};
type SightWorld = Pick<FarmWorld, 'farmer' | 'mode' | 'practice'>;

/** Reuse the GPU buffer: no polygon triangulation or geometry disposal on snapshots. */
export function createSightGeometry() {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    'position',
    new T.BufferAttribute(new Float32Array(256 * 9), 3).setUsage(
      T.DynamicDrawUsage,
    ),
  );
  geometry.setDrawRange(0, 0);
  return geometry;
}
export function updateSightGeometry(
  geometry: T.BufferGeometry,
  world: SightWorld,
) {
  const points = visionBoundary(world);
  const positions = geometry.getAttribute('position') as T.BufferAttribute;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    positions.setXYZ(i * 3, world.farmer.x, 0.115, world.farmer.z);
    positions.setXYZ(i * 3 + 1, a.x, 0.115, a.z);
    positions.setXYZ(i * 3 + 2, b.x, 0.115, b.z);
  }
  positions.needsUpdate = true;
  geometry.setDrawRange(0, points.length * 3);
}

// The same range, cone and hay footprints as the server, including the pool at the feet.
// This analytic light works on mobile without adding a shadow-map render pass.
const shader = `
varying vec3 vFarmPosition;
uniform vec3 farmLamp;
uniform float farmNight;
bool farmBlocked(vec2 delta, vec4 hay) {
  vec2 inv = vec2(delta.x < 0.0 ? -1.0 : 1.0, delta.y < 0.0 ? -1.0 : 1.0) / max(abs(delta), vec2(0.00001));
  vec2 a = (hay.xy - hay.zw * 0.5 - farmLamp.xy) * inv;
  vec2 b = (hay.xy + hay.zw * 0.5 - farmLamp.xy) * inv;
  float nearHit = max(min(a.x, b.x), min(a.y, b.y));
  float farHit = min(max(a.x, b.x), max(a.y, b.y));
  return farHit >= max(0.0, nearHit) && nearHit < 0.997 && farHit > 0.001;
}
float farmIllumination() {
  if (farmNight < 0.01) return 0.0;
  vec2 delta = vFarmPosition.xz - farmLamp.xy;
  float radius = length(delta);
  float facing = dot(delta / max(radius, 0.00001), vec2(sin(farmLamp.z), cos(farmLamp.z)));
  float cone = smoothstep(${Math.cos(SIGHT_HALF_ANGLE).toFixed(8)}, ${Math.cos(SIGHT_HALF_ANGLE - 0.12).toFixed(8)}, facing);
  float beam = cone * (1.0 - smoothstep(${(SIGHT_RANGE - 0.75).toFixed(2)}, ${SIGHT_RANGE.toFixed(2)}, radius));
  float feet = 1.0 - smoothstep(${(NEAR_SIGHT - 0.25).toFixed(2)}, ${NEAR_SIGHT.toFixed(2)}, radius);
  if (max(beam, feet) <= 0.0) return 0.0;
  ${FARM_COVER.map((c) => `if (farmBlocked(delta, vec4(${c.x.toFixed(2)}, ${c.z.toFixed(2)}, ${c.width.toFixed(2)}, ${c.depth.toFixed(2)}))) return 0.0;`).join('\n')}
  return max(beam, feet * 0.65) * farmNight * (1.0 - smoothstep(2.0, 4.0, vFarmPosition.y));
}
`;

export class FarmFlashlight {
  position = { value: new T.Vector3() };
  night = { value: 0 };
  bind(root: T.Object3D) {
    const materials = new Set<T.MeshStandardMaterial>();
    root.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material])
        if (material instanceof T.MeshStandardMaterial) materials.add(material);
    });
    for (const material of materials) {
      material.onBeforeCompile = (program) => {
        program.uniforms.farmLamp = this.position;
        program.uniforms.farmNight = this.night;
        program.vertexShader = program.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nvarying vec3 vFarmPosition;',
          )
          .replace(
            '#include <project_vertex>',
            'vFarmPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>',
          );
        program.fragmentShader = program.fragmentShader
          .replace('#include <common>', `#include <common>\n${shader}`)
          .replace(
            '#include <emissivemap_fragment>',
            '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(1.25, 1.04, 0.70) * farmIllumination();',
          );
      };
      material.customProgramCacheKey = () => 'farm-flashlight-v1';
      material.needsUpdate = true;
    }
  }
  update(farmer: FarmWorld['farmer'], night: boolean) {
    this.position.value.set(farmer.x, farmer.z, farmer.angle);
    this.night.value = night ? 1 : 0;
  }
}
