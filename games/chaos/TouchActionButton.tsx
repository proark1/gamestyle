'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { ActionContact } from './mobile-actions';

export function TouchActionButton({
  actionKey,
  disabled = false,
  onAction,
  children,
  className,
  label,
  immediate = false,
}: {
  actionKey: string;
  disabled?: boolean;
  onAction: () => void;
  children: ReactNode;
  className?: string;
  label?: string;
  immediate?: boolean;
}) {
  const contact = useRef(new ActionContact());
  useEffect(() => {
    const clear = () => contact.current.clear();
    const hidden = () => {
      if (document.hidden) clear();
    };
    window.addEventListener('blur', clear);
    window.addEventListener('pagehide', clear);
    window.addEventListener('permit-input-cancel', clear);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', clear);
      window.removeEventListener('pagehide', clear);
      window.removeEventListener('permit-input-cancel', clear);
      document.removeEventListener('visibilitychange', hidden);
      clear();
    };
  }, []);
  useEffect(() => {
    contact.current.clear();
  }, [actionKey, disabled]);
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      disabled={disabled}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (
          disabled ||
          e.button !== 0 ||
          !contact.current.down(e.pointerId, actionKey)
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          contact.current.clear();
          return;
        }
        if (immediate) onAction();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        const outside =
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom;
        if (
          contact.current.up(e.pointerId, actionKey, disabled || outside) &&
          !immediate
        )
          onAction();
      }}
      onPointerCancel={(e) => {
        contact.current.up(e.pointerId, actionKey, true);
      }}
      onLostPointerCapture={(e) => {
        contact.current.up(e.pointerId, actionKey, true);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.detail === 0 && !disabled) onAction();
      }}
    >
      {children}
    </button>
  );
}
