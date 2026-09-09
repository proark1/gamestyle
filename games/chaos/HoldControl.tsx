'use client';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';

export function HoldControl({
  onHeld,
  children,
  disabled = false,
  label,
  className,
}: {
  onHeld: (held: boolean, source: string) => void;
  children: ReactNode;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const source = useId();
  const pointer = useRef<number | 'keyboard' | null>(null);
  const latest = useRef(onHeld);
  useLayoutEffect(() => {
    latest.current = onHeld;
  }, [onHeld]);
  const release = useCallback(() => {
    if (pointer.current === null) return;
    pointer.current = null;
    latest.current(false, source);
  }, [source]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) release();
    };
    window.addEventListener('blur', release);
    window.addEventListener('pagehide', release);
    window.addEventListener('permit-input-cancel', release);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', release);
      window.removeEventListener('pagehide', release);
      window.removeEventListener('permit-input-cancel', release);
      document.removeEventListener('visibilitychange', hidden);
      release();
    };
  }, [release]);
  useEffect(() => {
    if (disabled) release();
  }, [disabled, release]);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      className={className}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0 || pointer.current !== null) return;
        e.preventDefault();
        e.stopPropagation();
        pointer.current = e.pointerId;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          pointer.current = null;
          return;
        }
        onHeld(true, source);
      }}
      onPointerUp={(e) => {
        if (pointer.current === e.pointerId) release();
      }}
      onPointerCancel={(e) => {
        if (pointer.current === e.pointerId) release();
      }}
      onLostPointerCapture={(e) => {
        if (pointer.current === e.pointerId) release();
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
          e.preventDefault();
          if (pointer.current === null) {
            pointer.current = 'keyboard';
            onHeld(true, source);
          }
        }
      }}
      onKeyUp={(e) => {
        if (
          pointer.current === 'keyboard' &&
          (e.key === ' ' || e.key === 'Enter')
        ) {
          e.preventDefault();
          release();
        }
      }}
      onBlur={release}
    >
      {children}
    </button>
  );
}
