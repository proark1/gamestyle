'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Settings, X } from 'lucide-react';

/** Keep one instance of each control when switching between phone and desktop. */
export default function ToolbarOptions({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        container.current?.contains(event.target as Node)
      ) {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="toolbar-options" ref={container}>
      <button
        ref={trigger}
        type="button"
        className="game-toolbar-button toolbar-options-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          // Safari does not focus buttons on tap. Keep Escape dismissal and
          // subsequent keyboard navigation anchored to the opened panel.
          event.currentTarget.focus({ preventScroll: true });
          setOpen((value) => !value);
        }}
      >
        {open ? <X size={19} /> : <Settings size={19} />}
      </button>
      <fieldset
        id={id}
        className="toolbar-options-panel"
        data-open={open}
        aria-label={label}
      >
        {children}
      </fieldset>
    </div>
  );
}
