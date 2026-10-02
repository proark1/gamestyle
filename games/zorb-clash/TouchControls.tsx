'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { PlayerInput } from './types';
import { movement } from './controls';

export function TouchControls({
  enabled,
  moveLabel,
  braceLabel,
  dashLabel,
  onInput,
  onCancel,
}: {
  enabled: boolean;
  moveLabel: string;
  braceLabel: string;
  dashLabel: string;
  onInput: (patch: Partial<PlayerInput>) => void;
  onCancel: () => void;
}) {
  const stick = useRef<{ id: number; x: number; y: number } | null>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState({ brace: false, dash: false });
  const actionPointers = useRef(new Map<number, 'brace' | 'dash'>());
  const resetStick = () => {
    stick.current = null;
    if (thumb.current) thumb.current.style.transform = 'translate(0, 0)';
    onInput({ x: 0, z: 0 });
  };
  useEffect(() => onCancel, [onCancel]);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled || stick.current?.id !== e.pointerId) return;
    const vector = movement(
      (e.clientX - stick.current.x) / 42,
      -(e.clientY - stick.current.y) / 42,
      0.12,
    );
    if (thumb.current)
      thumb.current.style.transform = `translate(${vector.x * 35}px, ${-vector.z * 35}px)`;
    onInput({ x: -vector.x, z: vector.z });
  };
  const action = (key: 'brace' | 'dash', value: boolean) => {
    setHeld((previous) => ({ ...previous, [key]: value }));
    onInput({ [key]: value });
  };
  return (
    <div className="zorb-touch-controls">
      <div
        className="zorb-touch-stick"
        aria-label={moveLabel}
        onPointerDown={(e) => {
          if (!enabled || stick.current) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        }}
        onPointerMove={move}
        onPointerUp={(e) => {
          if (stick.current?.id === e.pointerId) resetStick();
        }}
        onPointerCancel={(e) => {
          if (stick.current?.id === e.pointerId) resetStick();
        }}
        onLostPointerCapture={(e) => {
          if (stick.current?.id === e.pointerId) resetStick();
        }}
      >
        <div ref={thumb} className="zorb-touch-thumb" />
      </div>
      <div className="zorb-touch-actions">
        {(['brace', 'dash'] as const).map((key) => (
          <button
            key={key}
            type="button"
            disabled={!enabled}
            className={`zorb-touch-btn ${key}`}
            aria-pressed={held[key]}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              actionPointers.current.set(e.pointerId, key);
              action(key, true);
            }}
            onPointerUp={(e) => {
              if (!actionPointers.current.delete(e.pointerId)) return;
              if (![...actionPointers.current.values()].includes(key))
                action(key, false);
            }}
            onPointerCancel={(e) => {
              actionPointers.current.delete(e.pointerId);
              // Cancel a charged dash without treating cancellation as intentional release.
              onCancel();
              actionPointers.current.clear();
              setHeld({ brace: false, dash: false });
            }}
            onLostPointerCapture={(e) => {
              if (actionPointers.current.delete(e.pointerId)) {
                onCancel();
                setHeld({ brace: false, dash: false });
              }
            }}
            onKeyDown={(e) => {
              if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                action(key, true);
              }
            }}
            onKeyUp={(e) => {
              if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                action(key, false);
              }
            }}
            onBlur={() => action(key, false)}
          >
            {key === 'brace' ? braceLabel : dashLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
