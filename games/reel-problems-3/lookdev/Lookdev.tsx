'use client';
/* oxlint-disable react/react-compiler -- The Three.js runtime and input state intentionally live in refs. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  Gauge,
  Lightbulb,
  Maximize2,
  MousePointer2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  isTouchDevice,
  prefersReducedMotion,
} from '../../../shared/browser/device';
import { LOOK_STYLES, LOOK_STYLE_IDS, styleFromShortcut } from './styles';
import type {
  LookdevInput,
  LookdevRuntime,
  LookdevStats,
  LookStyleId,
} from './types';
import './style.css';

const EMPTY_INPUT: LookdevInput = { forward: 0, strafe: 0, sprint: false };
const CHECKS = [
  [
    'materials',
    'Materials',
    'Do wood, clay, stone and cloth feel distinct up close?',
  ],
  [
    'water',
    'Water',
    'Does the shoreline feel alive without becoming distracting?',
  ],
  ['lighting', 'Lighting', 'Does the beacon reshape the scene when activated?'],
  [
    'distance',
    'Distance',
    'Do the island layers create a convincing sense of place?',
  ],
  [
    'hands',
    'First person',
    'Do the hands and scale feel natural while moving?',
  ],
  [
    'readability',
    'Readability',
    'Can you find and understand the beacon interaction?',
  ],
] as const;

export default function ReelProblems3Lookdev() {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<LookdevRuntime | null>(null);
  const keys = useRef(new Set<string>());
  const input = useRef<LookdevInput>({ ...EMPTY_INPUT });
  const touchLook = useRef<{ id: number; x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [style, setStyle] = useState<LookStyleId>('storybook');
  const [target, setTarget] = useState<'beacon' | null>(null);
  const [beaconLit, setBeaconLit] = useState(false);
  const [stats, setStats] = useState<LookdevStats>({ fps: 0, frameMs: 0 });
  const [guideOpen, setGuideOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [reducedMotion, setReducedMotion] = useState(false);
  const [touch, setTouch] = useState(false);

  const chooseStyle = useCallback((next: LookStyleId) => {
    setStyle(next);
    runtime.current?.setStyle(next);
  }, []);

  const updateInput = useCallback(() => {
    const next = {
      forward:
        (keys.current.has('KeyW') || keys.current.has('ArrowUp') ? 1 : 0) -
        (keys.current.has('KeyS') || keys.current.has('ArrowDown') ? 1 : 0),
      strafe:
        (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0) -
        (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0),
      sprint: keys.current.has('ShiftLeft') || keys.current.has('ShiftRight'),
    };
    input.current = next;
    runtime.current?.setInput(next);
  }, []);

  const interact = useCallback(() => {
    runtime.current?.activateBeacon();
  }, []);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    setTouch(isTouchDevice());
    setReducedMotion(reduced);
    let cancelled = false;
    let view: LookdevRuntime | null = null;
    void import('./scene').then(({ ReelProblems3LookdevScene }) => {
      if (cancelled || !host.current) return;
      view = new ReelProblems3LookdevScene(
        host.current,
        setTarget,
        setStats,
        setBeaconLit,
      );
      view.setReducedMotion(reduced);
      runtime.current = view;
      setReady(true);
    });
    return () => {
      cancelled = true;
      view?.dispose();
      runtime.current = null;
    };
  }, []);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const active = event.target as HTMLElement | null;
      const editing = active?.closest('input,textarea,select,button,a');
      const shortcut = styleFromShortcut(event.code);
      if (event.type === 'keydown' && shortcut && !editing) {
        event.preventDefault();
        chooseStyle(shortcut);
        return;
      }
      if (editing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'ShiftLeft',
          'ShiftRight',
          'KeyE',
          'KeyR',
        ].includes(event.code)
      )
        event.preventDefault();
      if (event.type === 'keydown') keys.current.add(event.code);
      else keys.current.delete(event.code);
      updateInput();
      if (event.type === 'keydown' && !event.repeat && event.code === 'KeyE')
        interact();
      if (event.type === 'keydown' && !event.repeat && event.code === 'KeyR')
        runtime.current?.reset();
    };
    const down = (event: KeyboardEvent) => handle(event);
    const up = (event: KeyboardEvent) => handle(event);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [chooseStyle, interact, updateInput]);

  useEffect(() => {
    runtime.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  const setTouchMove = (axis: 'forward' | 'strafe', value: number) => {
    input.current = { ...input.current, [axis]: value };
    runtime.current?.setInput(input.current);
  };
  const moveButton = (axis: 'forward' | 'strafe', value: number) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setTouchMove(axis, value);
    },
    onPointerUp: () => setTouchMove(axis, 0),
    onPointerCancel: () => setTouchMove(axis, 0),
  });
  const moveLook = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previous = touchLook.current;
    if (!previous || previous.id !== event.pointerId) return;
    runtime.current?.look(
      (event.clientX - previous.x) * 1.2,
      (event.clientY - previous.y) * 1.2,
    );
    touchLook.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const active = LOOK_STYLES[style];

  return (
    <main
      className={`rp3-lookdev ${touch ? 'is-touch' : ''}`}
      data-look={style}
    >
      <div className="rp3-lookdev-world" ref={host} />
      <div className="rp3-lookdev-comic-texture" aria-hidden="true" />

      <header className="rp3-lookdev-topbar">
        <a href="/reel-problems-3" className="rp3-lookdev-back">
          <ArrowLeft /> <span>Adventure</span>
        </a>
        <div className="rp3-lookdev-title">
          <span>
            REEL PROBLEMS <b>3</b>
          </span>
          <small>BEACON ISLAND · REAL-TIME LOOKDEV</small>
        </div>
        <div
          className="rp3-lookdev-performance"
          aria-label="Rendering performance"
        >
          <Gauge />
          <strong>{stats.fps || '—'} FPS</strong>
          <span>{stats.frameMs || '—'} ms</span>
        </div>
      </header>

      <section className="rp3-lookdev-objective" aria-live="polite">
        <small>{beaconLit ? 'BEACON AWAKE' : 'THE OLD LIGHT'}</small>
        <strong>
          {beaconLit
            ? 'Walk the shore and judge how the light settles into the world.'
            : 'Follow the dock and wake the beacon.'}
        </strong>
        <i className={beaconLit ? 'is-complete' : ''} />
      </section>

      <nav className="rp3-lookdev-switcher" aria-label="Visual treatment">
        <div className="rp3-lookdev-switcher-head">
          <div>
            <small>LIVE ART DIRECTION</small>
            <strong>{active.label}</strong>
          </div>
          <Sparkles />
        </div>
        <div className="rp3-lookdev-tabs">
          {LOOK_STYLE_IDS.map((id) => {
            const option = LOOK_STYLES[id];
            return (
              <button
                key={id}
                className={style === id ? 'is-active' : ''}
                aria-pressed={style === id}
                onClick={() => chooseStyle(id)}
              >
                <kbd>{option.key}</kbd>
                <span>
                  <small>{option.eyebrow}</small>
                  <strong>{option.label}</strong>
                </span>
                {style === id ? <Check /> : null}
              </button>
            );
          })}
        </div>
        <p>{active.description}</p>
      </nav>

      <div className="rp3-lookdev-actions">
        <button
          onClick={() => runtime.current?.reset()}
          title="Reset position (R)"
        >
          <RotateCcw /> <span>Reset</span>
        </button>
        <button
          onClick={() => void document.documentElement.requestFullscreen?.()}
          title="Enter full screen"
        >
          <Maximize2 /> <span>Full screen</span>
        </button>
        <button
          className={guideOpen ? 'is-active' : ''}
          onClick={() => setGuideOpen((open) => !open)}
          aria-expanded={guideOpen}
        >
          <Eye /> <span>Review</span> <ChevronDown />
        </button>
      </div>

      {guideOpen ? (
        <aside className="rp3-lookdev-guide">
          <div className="rp3-lookdev-guide-head">
            <span>
              <Lightbulb /> LOOK FOR
            </span>
            <strong>
              {checked.size}/{CHECKS.length}
            </strong>
          </div>
          {CHECKS.map(([id, label, detail]) => (
            <button
              key={id}
              className={checked.has(id) ? 'is-checked' : ''}
              onClick={() =>
                setChecked((current) => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
            >
              <i>{checked.has(id) ? <Check /> : null}</i>
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
            </button>
          ))}
          <label>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />
            Reduce environmental motion
          </label>
        </aside>
      ) : null}

      <div
        className={`rp3-lookdev-reticle ${target ? 'has-target' : ''}`}
        aria-hidden="true"
      >
        <i />
        <i />
      </div>

      <div className={`rp3-lookdev-prompt ${target ? 'is-visible' : ''}`}>
        <MousePointer2 />
        <span>
          <kbd>E</kbd> {beaconLit ? 'DIM BEACON' : 'WAKE BEACON'}
        </span>
      </div>

      {!touch ? (
        <div className="rp3-lookdev-controls">
          <span>
            <kbd>WASD</kbd> MOVE
          </span>
          <span>
            <MousePointer2 /> LOOK
          </span>
          <span>
            <kbd>1–3</kbd> SWITCH STYLE
          </span>
        </div>
      ) : (
        <div className="rp3-lookdev-touch">
          <div
            className="rp3-lookdev-touch-look"
            aria-label="Drag to look"
            onPointerDown={(event) => {
              touchLook.current = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={moveLook}
            onPointerUp={() => {
              touchLook.current = null;
            }}
            onPointerCancel={() => {
              touchLook.current = null;
            }}
          />
          <div className="rp3-lookdev-touch-move">
            <button {...moveButton('forward', 1)} aria-label="Move forward">
              ▲
            </button>
            <button {...moveButton('strafe', -1)} aria-label="Move left">
              ◀
            </button>
            <button {...moveButton('forward', -1)} aria-label="Move backward">
              ▼
            </button>
            <button {...moveButton('strafe', 1)} aria-label="Move right">
              ▶
            </button>
          </div>
          <button className="rp3-lookdev-touch-use" onClick={interact}>
            <b>E</b>
            <span>USE</span>
          </button>
        </div>
      )}

      {!ready ? (
        <div className="rp3-lookdev-loading">
          <span />
          <strong>Building beacon island…</strong>
        </div>
      ) : null}
    </main>
  );
}
