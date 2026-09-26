import * as T from 'three';
import type { ComicTreatmentId } from './types';

export type ComicTreatment = {
  mode: number;
  bands: number;
  intensity: number;
  contrast: number;
  outlineScale: number;
  ghostOpacity: number;
};

export const COMIC_TREATMENTS: Record<ComicTreatmentId, ComicTreatment> = {
  none: {
    mode: 0,
    bands: 5,
    intensity: 0,
    contrast: 1,
    outlineScale: 1.006,
    ghostOpacity: 0,
  },
  adventure: {
    mode: 1,
    bands: 4,
    intensity: 0.82,
    contrast: 1.08,
    outlineScale: 1.012,
    ghostOpacity: 0,
  },
  noir: {
    mode: 2,
    bands: 3,
    intensity: 0.94,
    contrast: 1.24,
    outlineScale: 1.016,
    ghostOpacity: 0,
  },
  sketch: {
    mode: 3,
    bands: 5,
    intensity: 0.64,
    contrast: 0.96,
    outlineScale: 1.009,
    ghostOpacity: 0.34,
  },
};

type ComicUniforms = {
  comicMode: { value: number };
  comicBands: { value: number };
  comicIntensity: { value: number };
  comicContrast: { value: number };
};

type ComicMaterial = T.MeshStandardMaterial & {
  userData: T.MeshStandardMaterial['userData'] & {
    comicUniforms?: ComicUniforms;
  };
};

export function installComicTreatment(material: ComicMaterial) {
  const uniforms: ComicUniforms = {
    comicMode: { value: 0 },
    comicBands: { value: 5 },
    comicIntensity: { value: 0 },
    comicContrast: { value: 1 },
  };
  material.userData.comicUniforms = uniforms;
  material.customProgramCacheKey = () => 'rp3-comic-material-v1';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = `
      uniform float comicMode;
      uniform float comicBands;
      uniform float comicIntensity;
      uniform float comicContrast;
    ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <output_fragment>',
      `#include <output_fragment>
      if (comicMode > 0.5) {
        float comicLuma = dot(gl_FragColor.rgb, vec3(.2126, .7152, .0722));
        float safeLuma = max(comicLuma, .035);
        float normalizedLuma = clamp(comicLuma, 0.0, 1.0);
        float band = floor(normalizedLuma * (comicBands - 1.0) + .5)
          / max(1.0, comicBands - 1.0);
        vec3 chroma = gl_FragColor.rgb / safeLuma;
        vec3 celColor = chroma * band;
        celColor = (celColor - .5) * comicContrast + .5;
        if (comicMode > 2.5) {
          float paperNoise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
          celColor *= .965 + paperNoise * .07;
        }
        gl_FragColor.rgb = mix(gl_FragColor.rgb, celColor, comicIntensity);
      }`,
    );
  };
}

export function applyComicTreatment(
  material: ComicMaterial,
  treatment: ComicTreatmentId,
) {
  const uniforms = material.userData.comicUniforms;
  if (!uniforms) return;
  const next = COMIC_TREATMENTS[treatment];
  uniforms.comicMode.value = next.mode;
  uniforms.comicBands.value = next.bands;
  uniforms.comicIntensity.value = next.intensity;
  uniforms.comicContrast.value = next.contrast;
}
