import { apiFetch } from '../browser/api-fetch';
import { getPlatform } from '../browser/platform';
import type { Game } from '../games/identity';
import { DiagnosticAccumulator } from './model';
import {
  DIAGNOSTICS_ENDPOINT,
  type DiagnosticBatch,
  type DiagnosticEngine,
} from './protocol';

declare const __GAME_BUILD_ID__: string | undefined;
export function diagnosticRelease() {
  const value =
    typeof __GAME_BUILD_ID__ === 'string' ? __GAME_BUILD_ID__ : 'local';
  return /^[a-zA-Z0-9._-]{1,64}$/.test(value) ? value : 'local';
}
export function diagnosticEngine(agent: string): DiagnosticEngine {
  if (/Firefox\//.test(agent)) return 'firefox';
  if (/Chrome\/|Chromium\/|Edg\//.test(agent)) return 'chromium';
  if (/AppleWebKit\//.test(agent)) return 'webkit';
  return 'other';
}

/** Bounded, anonymous summaries. No persistent IDs, error text, paths or GPU fingerprints. */
export function startDiagnostics(game: Game, initialNavigation = false) {
  const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (privacy.doNotTrack === '1' || privacy.globalPrivacyControl)
    return () => {};
  const started = initialNavigation ? 0 : performance.now();
  const model = new DiagnosticAccumulator(started);
  const id =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('');
  const platform =
    location.protocol === 'jumbleyard-app:' ? 'desktop' : getPlatform();
  const engine = diagnosticEngine(navigator.userAgent);
  const release = diagnosticRelease();
  let delivery = 0,
    disposed = false,
    dirty = true,
    sending = false,
    lastSample = -Infinity;
  const send = async (final = false) => {
    if (!dirty || (sending && !final)) return;
    dirty = false;
    sending = true;
    const batch: DiagnosticBatch = {
      v: 1,
      id,
      game,
      delivery: ++delivery,
      elapsedMs: Math.min(
        86400000,
        Math.max(0, Math.round(performance.now() - started)),
      ),
      platform,
      engine,
      release,
      summary: model.snapshot(),
    };
    try {
      const response = await apiFetch(DIAGNOSTICS_ENDPOINT, {
        method: 'POST',
        credentials: 'omit',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (!response.ok && (response.status >= 500 || response.status === 429))
        dirty = true;
    } catch {
      dirty = true;
    } finally {
      sending = false;
    }
  };
  const tick = () => {
    if (document.visibilityState !== 'visible') return;
    const now = performance.now();
    const previous = model.summary.errors['start-timeout'];
    model.checkTimeout(now);
    if (previous !== model.summary.errors['start-timeout']) dirty = true;
    const canvas = document.querySelector<HTMLCanvasElement>(
      'canvas[data-performance]',
    );
    if (!canvas?.dataset.performance) return;
    try {
      const frame = JSON.parse(canvas.dataset.performance) as {
        frames?: number;
      };
      if ((frame.frames ?? 0) > 0 && model.summary.readyMs === null) {
        model.ready(now);
        dirty = true;
      }
      if (
        now - lastSample >= 30000 &&
        ![...document.querySelectorAll('dialog[open],[role="dialog"]')].some(
          (dialog) => dialog.getClientRects().length > 0,
        ) &&
        model.sample(frame)
      ) {
        lastSample = now;
        dirty = true;
      }
    } catch {
      /* A partial diagnostic update never affects gameplay. */
    }
  };
  const error = (event: Event) => {
    // Failed image/audio downloads are counted without recording their URL.
    model.error(event.target === window ? 'javascript' : 'resource');
    dirty = true;
  };
  const rejection = () => {
    model.error('rejection');
    dirty = true;
  };
  const graphics = () => {
    model.error('graphics-lost');
    dirty = true;
  };
  const offline = () => {
    model.error('offline');
    dirty = true;
  };
  const online = () => {
    void send();
  };
  const hide = () => {
    tick();
    void send(true);
  };
  const visibility = () => {
    if (document.visibilityState === 'hidden') hide();
    else tick();
  };
  window.addEventListener('error', error, true);
  window.addEventListener('unhandledrejection', rejection);
  document.addEventListener('webglcontextlost', graphics, true);
  window.addEventListener('offline', offline);
  window.addEventListener('online', online);
  window.addEventListener('pagehide', hide);
  document.addEventListener('visibilitychange', visibility);
  const sampleTimer = setInterval(tick, 2000);
  const sendTimer = setInterval(() => {
    void send();
  }, 30000);
  const firstReport = setTimeout(() => {
    tick();
    void send();
  }, 5000);
  const observer = new MutationObserver(() => {
    const canvas = document.querySelector('canvas[data-performance]');
    if (canvas) {
      observer.disconnect();
      observer.observe(canvas, {
        attributes: true,
        attributeFilter: ['data-performance'],
      });
    }
    tick();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-performance'],
  });
  return () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    clearInterval(sampleTimer);
    clearInterval(sendTimer);
    clearTimeout(firstReport);
    window.removeEventListener('error', error, true);
    window.removeEventListener('unhandledrejection', rejection);
    document.removeEventListener('webglcontextlost', graphics, true);
    window.removeEventListener('offline', offline);
    window.removeEventListener('online', online);
    window.removeEventListener('pagehide', hide);
    document.removeEventListener('visibilitychange', visibility);
    hide();
  };
}
