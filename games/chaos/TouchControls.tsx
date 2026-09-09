'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import { bindJoystick } from './joystick';

export function TouchControls({
  onMove,
  onJump,
  showJump = true,
  allowSprint = true,
}: {
  onMove: (x: number, z: number, sprint: boolean) => void;
  onJump: () => void;
  showJump?: boolean;
  allowSprint?: boolean;
}) {
  const pad = useRef<HTMLDivElement>(null);
  const move = useEffectEvent((x: number, z: number, sprint: boolean) =>
    onMove(x, z, allowSprint && sprint),
  );
  useEffect(
    () => bindJoystick(pad.current!, (x, z, sprint) => move(x, z, sprint)),
    [],
  );
  return (
    <div className="touch-controls">
      <div
        ref={pad}
        className={`touch-pad ${allowSprint ? 'has-sprint' : ''}`}
        aria-label="Virtual joystick: touch and drag to walk"
      >
        <span>✥</span>
        <small>
          {allowSprint ? 'Move · outer ring sprints' : 'Move the load'}
        </small>
      </div>
      {showJump && (
        <button
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            onJump();
          }}
          onClick={(event) => {
            if (event.detail === 0) onJump();
          }}
          aria-label="Jump"
        >
          <ArrowUp size={23} />
          <span>Jump</span>
        </button>
      )}
    </div>
  );
}
