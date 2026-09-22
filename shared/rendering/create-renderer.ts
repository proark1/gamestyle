import * as T from 'three';
import { attachRenderRuntime } from './runtime';
import {
  renderQuality,
  type RenderQuality,
  type SceneWeight,
} from '../browser/device';

export type ShadowStyle = 'soft' | 'hard' | 'off';

/**
 * three 0.185 deprecated PCFSoftShadowMap: `WebGLShadowMap` swaps it for
 * PCFShadowMap on the first render and warns, so asking for soft shadows only
 * bought a console warning. `soft` therefore means "the best shadows this three
 * version offers", which today is the same map as `hard`. The distinction stays
 * in the type because the games mean different things by it, and because this
 * becomes one line to change if soft shadows come back.
 */
const SHADOW_MAP = T.PCFShadowMap;

export type RendererOptions = {
  /**
   * What the canvas is and how to play it, read out by screen readers. Games
   * put their control summary here.
   */
  label?: string;
  /**
   * Shadow style, so a game keeps its own look: `soft` for PCFSoftShadowMap,
   * `hard` for the cheaper PCFShadowMap, `off` for none. A game that drops
   * shadows on a phone passes `quality.touch ? 'off' : 'soft'`.
   */
  shadows?: ShadowStyle;
  /** Tone-mapping exposure. Omitted leaves tone mapping at the Three default. */
  exposure?: number;
  /** How much scene this game draws. See `SceneWeight`. */
  weight?: SceneWeight;
  /** Set when a game offers its own quality switch. */
  quality?: RenderQuality;
  /** Keyboard-focusable canvas. On by default: games read keys off it. */
  focusable?: boolean;
};

export type GameRenderer = {
  renderer: T.WebGLRenderer;
  /** The tier this renderer was built for, for scenes that tune further. */
  quality: RenderQuality;
};

/**
 * Builds a renderer with the collection's device policy already applied and
 * attaches its canvas to `host`.
 *
 * Nineteen scenes used to configure this by hand and had drifted apart: twelve
 * different pixel-ratio caps, and only five that reduced anything at all on a
 * phone. The device policy now lives in `shared/browser/device.ts`; what is
 * genuinely per-game — shadow style, exposure, the accessible label — stays a
 * parameter here.
 *
 * Sizing is left to the caller. Every scene already owns a ResizeObserver that
 * has to update its camera aspect in the same place, so a second owner here
 * would only fight it.
 */
/** Everything the options and the device tier decide, before any WebGL exists. */
export type RendererSettings = {
  antialias: boolean;
  pixelRatio: number;
  shadows: boolean;
  exposure: number | undefined;
  focusable: boolean;
};

/**
 * Resolves the options against the device tier. Split out from `createRenderer`
 * so the policy can be asserted without a GL context.
 */
export function rendererSettings(
  options: RendererOptions = {},
): RendererSettings {
  const quality = options.quality ?? renderQuality(options.weight);
  const shadows = options.shadows ?? 'soft';
  return {
    antialias: quality.antialias,
    pixelRatio: quality.pixelRatio,
    shadows: shadows !== 'off',
    exposure: options.exposure,
    focusable: options.focusable !== false,
  };
}

export function createRenderer(
  host: HTMLElement,
  options: RendererOptions = {},
): GameRenderer {
  const quality = options.quality ?? renderQuality(options.weight);
  const settings = rendererSettings({ ...options, quality });
  const renderer = new T.WebGLRenderer({
    antialias: settings.antialias,
    alpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(settings.pixelRatio);

  renderer.shadowMap.enabled = settings.shadows;
  if (settings.shadows) renderer.shadowMap.type = SHADOW_MAP;
  renderer.outputColorSpace = T.SRGBColorSpace;
  if (settings.exposure !== undefined) {
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = settings.exposure;
  }

  const canvas = renderer.domElement;
  if (settings.focusable) canvas.tabIndex = 0;
  if (options.label) canvas.setAttribute('aria-label', options.label);
  host.appendChild(canvas);
  attachRenderRuntime(renderer, quality);

  return { renderer, quality };
}
