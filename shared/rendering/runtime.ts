import type { WebGLRenderer, Camera, Object3D, Light } from 'three';
import { bindGameLifecycle, gameActive } from '../browser/game-lifecycle';
import type { RenderQuality } from '../browser/device';
import { FrameStats } from './frame-stats';
import { AdaptiveQuality } from './adaptive-quality';
import { FramePacer } from './frame-pacer';
const admissions = new WeakMap<WebGLRenderer, () => boolean>();
export function shouldRenderFrame(renderer: WebGLRenderer) {
  return admissions.get(renderer)?.() ?? true;
}
import {
  graphicsPreferences,
  subscribeGraphicsPreferences,
} from './preferences';

/** Attach once at renderer creation so every game gets recovery and diagnostics. */
export function attachRenderRuntime(
  renderer: WebGLRenderer,
  quality: RenderQuality,
) {
  const stats = new FrameStats(),
    adaptive = new AdaptiveQuality(),
    pacer = new FramePacer();
  const canvas = renderer.domElement;
  const render = renderer.render.bind(renderer),
    dispose = renderer.dispose.bind(renderer);
  const lights = new WeakSet<Object3D>();
  let previous = 0,
    published = -Infinity,
    lost = false;
  let lastFrame = -1,
    skip = false;
  const originalRatio = renderer.getPixelRatio();
  const originalShadows = renderer.shadowMap.enabled;
  const apply = () => {
    const preference = graphicsPreferences();
    const level =
      preference.quality === 'auto'
        ? adaptive.level
        : preference.quality === 'low'
          ? 2
          : 0;
    renderer.setPixelRatio(
      Math.max(0.75, originalRatio * [1, 0.8, 0.65][level]),
    );
    renderer.shadowMap.enabled = originalShadows && level < 2;
  };
  const unsubscribe = subscribeGraphicsPreferences(apply);
  apply();
  const reset = () => {
    previous = 0;
    adaptive.reset();
    pacer.reset();
  };
  const unbind = bindGameLifecycle(reset);
  const message = document.createElement('output');
  message.setAttribute('aria-live', 'polite');
  Object.assign(message.style, {
    position: 'absolute',
    inset: '40% 10% auto',
    padding: '1rem',
    background: '#fff6df',
    color: '#294a43',
    borderRadius: '12px',
    zIndex: '100',
  });
  const contextLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    reset();
    message.textContent = 'Graphics interrupted. Restoring the game…';
    canvas.parentElement?.appendChild(message);
  };
  const restored = () => {
    lost = false;
    reset();
    message.remove();
  };
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', restored);
  let workStarted = 0;
  const admit = () => {
    if (!gameActive() || lost) {
      pacer.reset();
      previous = 0;
      return false;
    }
    const now = performance.now();
    const timeline = document.timeline?.currentTime;
    const stamp = typeof timeline === 'number' ? timeline : Math.floor(now);
    const due = pacer.due(stamp, graphicsPreferences().fps);
    if (due && stamp !== lastFrame) workStarted = now;
    return due;
  };
  admissions.set(renderer, admit);
  renderer.render = (scene: Object3D, camera: Camera) => {
    if (!gameActive() || lost) {
      previous = 0;
      return;
    }
    const now = performance.now(),
      gap = previous ? now - previous : 0;
    const timeline = document.timeline?.currentTime;
    const stamp = typeof timeline === 'number' ? timeline : Math.floor(now);
    const preference = graphicsPreferences();
    const frame = stamp !== lastFrame;
    if (frame) {
      lastFrame = stamp;
      skip = !pacer.due(stamp, preference.fps);
      if (!workStarted) workStarted = now;
    }
    if (skip) return;
    // Multiple passes in one frame should neither count nor alter quality twice.
    if (frame) {
      previous = now;
      if (
        gap &&
        preference.quality === 'auto' &&
        adaptive.record(pacer.qualityGap(gap, preference.fps))
      )
        apply();
      if (now - published > 1000) {
        published = now;
        // Traverse at most once a second; newly introduced lights get the same budget.
        scene.traverse((object) => {
          if (lights.has(object)) return;
          lights.add(object);
          const shadow = (
            object as Light & {
              shadow?: {
                mapSize: {
                  x: number;
                  y: number;
                  set: (x: number, y: number) => void;
                };
                map?: { dispose: () => void } | null;
              };
            }
          ).shadow;
          if (
            shadow &&
            (shadow.mapSize.x > quality.shadowMapSize ||
              shadow.mapSize.y > quality.shadowMapSize)
          ) {
            shadow.map?.dispose();
            shadow.map = null;
            shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
          }
        });
        canvas.dataset.performance = JSON.stringify({
          ...stats.read(),
          quality: adaptive.level,
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        });
      }
    }
    render(scene, camera);
    if (frame) {
      stats.record(gap, performance.now() - (workStarted || now));
      workStarted = 0;
    }
  };
  renderer.dispose = () => {
    admissions.delete(renderer);
    unbind();
    unsubscribe();
    message.remove();
    canvas.removeEventListener('webglcontextlost', contextLost);
    canvas.removeEventListener('webglcontextrestored', restored);
    dispose();
  };
}
