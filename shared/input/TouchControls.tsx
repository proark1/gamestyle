'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { ArrowUp } from 'lucide-react';
import { JoystickGesture } from './gestures';
import './touch-controls.css';

type Vector = { x: number; z: number };
export function TouchControls({
  disabled,
  move,
  jump,
}: {
  disabled: boolean;
  move: (vector: Vector) => void;
  jump: () => void;
}) {
  const gesture = useRef(new JoystickGesture());
  const pad = useRef<HTMLButtonElement>(null),
    thumb = useRef<HTMLSpanElement>(null);
  const keys = useRef(new Set<string>());
  const moveRef = useRef(move);
  const disabledRef = useRef(disabled);
  useLayoutEffect(() => {
    moveRef.current = move;
    disabledRef.current = disabled;
  }, [move, disabled]);
  function publish(vector: Vector) {
    if (thumb.current) {
      thumb.current.style.setProperty(
        '--stick-x',
        `${vector.x * gesture.current.radius}px`,
      );
      thumb.current.style.setProperty(
        '--stick-y',
        `${vector.z * gesture.current.radius}px`,
      );
    }
    moveRef.current(vector);
  }
  function reset() {
    const id = gesture.current.owner;
    gesture.current.clear();
    keys.current.clear();
    if (pad.current) {
      pad.current.dataset.engaged = 'false';
      if (id !== null && pad.current.hasPointerCapture(id))
        pad.current.releasePointerCapture(id);
    }
    publish({ x: 0, z: 0 });
  }
  useEffect(() => {
    const stick = gesture.current;
    const stopMoving = () => moveRef.current({ x: 0, z: 0 });
    const hidden = () => {
      if (document.hidden) reset();
    };
    // Toolbar height changes must not cancel an owned drag.
    let width = window.innerWidth;
    const resize = () => {
      if (Math.abs(window.innerWidth - width) > 2) {
        width = window.innerWidth;
        reset();
      }
    };
    const release = (event: globalThis.PointerEvent) => {
      if (gesture.current.owner === event.pointerId) reset();
    };
    const preventPan = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };
    const node = pad.current;
    node?.addEventListener('touchmove', preventPan, { passive: false });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', reset);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', reset);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      node?.removeEventListener('touchmove', preventPan);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', reset);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', reset);
      document.removeEventListener('visibilitychange', hidden);
      stick.clear();
      stopMoving();
    };
  }, []);
  useEffect(() => {
    if (disabled) reset();
  }, [disabled]);
  function stop(event: PointerEvent | KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
  }
  function finish(event: PointerEvent<HTMLButtonElement>) {
    if (gesture.current.owner !== event.pointerId) return;
    stop(event);
    reset();
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, pressed: boolean) {
    const key = event.key.toLowerCase();
    if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key))
      return;
    stop(event);
    if (disabledRef.current || gesture.current.owner !== null) return;
    if (pressed) keys.current.add(key);
    else keys.current.delete(key);
    const x =
      Number(keys.current.has('arrowright')) -
      Number(keys.current.has('arrowleft'));
    const z =
      Number(keys.current.has('arrowdown')) -
      Number(keys.current.has('arrowup'));
    const length = Math.max(1, Math.hypot(x, z));
    event.currentTarget.dataset.engaged = String(!!(x || z));
    publish({ x: x / length, z: z / length });
  }
  return (
    <div
      className="touch-controls"
      data-touch-controls
      aria-label="Touch controls"
      aria-disabled={disabled}
    >
      <button
        type="button"
        className="joystick"
        ref={pad}
        aria-label="Movement joystick. Drag or use arrow keys; release to stop."
        disabled={disabled}
        aria-disabled={disabled}
        onKeyDown={(event) => keyboard(event, true)}
        onKeyUp={(event) => keyboard(event, false)}
        onBlur={reset}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          stop(event);
          if (disabledRef.current || event.button !== 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const radius = Math.max(18, Math.min(rect.width, rect.height) * 0.3);
          if (
            !gesture.current.down(
              event.pointerId,
              event.clientX,
              event.clientY,
              radius,
            )
          )
            return;
          event.currentTarget.dataset.engaged = 'true';
          keys.current.clear();
          event.currentTarget.setPointerCapture(event.pointerId);
          publish({ x: 0, z: 0 });
        }}
        onPointerMove={(event) => {
          if (gesture.current.owner !== event.pointerId) return;
          stop(event);
          if (disabledRef.current) {
            reset();
            return;
          }
          const next = gesture.current.move(
            event.pointerId,
            event.clientX,
            event.clientY,
          );
          if (next) publish(next);
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
      >
        <span ref={thumb}>
          <ArrowUp size={24} />
        </span>
        <small>MOVE</small>
      </button>
      <button
        className="touch-jump"
        disabled={disabled}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          stop(event);
          if (event.button === 0 && !disabledRef.current) jump();
        }}
        onClick={(event) => {
          if (event.detail === 0 && !disabledRef.current) jump();
        }}
        aria-label="Jump"
      >
        <ArrowUp size={26} />
        <span>JUMP</span>
      </button>
    </div>
  );
}
