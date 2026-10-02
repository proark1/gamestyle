'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { TouchControls as Joystick } from '../../shared/input/TouchControls';
import type { Role } from './types';

export default function CraneTouchControls({
  solo,
  role,
  disabled,
  de,
  move,
  hoist,
  grab,
}: {
  solo: boolean;
  role: Role;
  disabled: boolean;
  de: boolean;
  move: (role: Role, vector: { x: number; z: number }) => void;
  hoist: (direction: number) => void;
  grab: () => void;
}) {
  const [mode, setMode] = useState<Role>(role);
  const activeRole = solo ? mode : role;
  const owner = useRef<number | null>(null);
  const callbacks = useRef({ move, hoist });
  useEffect(() => {
    callbacks.current = { move, hoist };
  }, [move, hoist]);
  useEffect(() => {
    const reset = () => {
      owner.current = null;
      callbacks.current.hoist(0);
      callbacks.current.move('swinger', { x: 0, z: 0 });
    };
    const hidden = () => {
      if (document.hidden) reset();
    };
    window.addEventListener('blur', reset);
    window.addEventListener('orientationchange', reset);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', reset);
      window.removeEventListener('orientationchange', reset);
      document.removeEventListener('visibilitychange', hidden);
      reset();
    };
  }, []);
  useEffect(() => {
    if (disabled) {
      owner.current = null;
      hoist(0);
    }
  }, [disabled, hoist]);
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (owner.current !== event.pointerId) return;
    owner.current = null;
    hoist(0);
  };
  return (
    <div className="cc-touch-ui">
      <Joystick
        key={activeRole}
        disabled={disabled}
        showJump={false}
        jump={grab}
        move={(vector) => move(activeRole, vector)}
        moveLabel={
          activeRole === 'operator'
            ? de
              ? 'KRAN'
              : 'CRANE'
            : de
              ? 'SCHWINGEN'
              : 'SWING'
        }
      />
      <div className="cc-touch-actions">
        {solo && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              move(activeRole, { x: 0, z: 0 });
              setMode(activeRole === 'operator' ? 'swinger' : 'operator');
            }}
          >
            {activeRole === 'operator'
              ? de
                ? 'Zum Schwingen'
                : 'Control swing'
              : de
                ? 'Zum Kran'
                : 'Control crane'}
          </button>
        )}
        {(solo || role === 'operator') && (
          <div className="cc-hoist-actions">
            {([1, -1] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                disabled={disabled}
                onContextMenu={(event) => event.preventDefault()}
                onPointerDown={(event) => {
                  if (event.button !== 0 || owner.current !== null) return;
                  event.preventDefault();
                  owner.current = event.pointerId;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  hoist(direction);
                }}
                onPointerUp={release}
                onPointerCancel={release}
                onLostPointerCapture={release}
                onKeyDown={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault();
                    hoist(direction);
                  }
                }}
                onKeyUp={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault();
                    hoist(0);
                  }
                }}
                onBlur={() => {
                  owner.current = null;
                  hoist(0);
                }}
              >
                {direction === 1
                  ? de
                    ? '↑ Heben'
                    : '↑ Hoist'
                  : de
                    ? '↓ Senken'
                    : '↓ Lower'}
              </button>
            ))}
          </div>
        )}
        {(solo || role === 'swinger') && (
          <button type="button" disabled={disabled} onClick={grab}>
            {de ? 'Greifen / Loslassen' : 'Grab / release'}
          </button>
        )}
      </div>
    </div>
  );
}
