'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/** Native modal provides focus containment, inert background and focus return. */
export function CarryOnModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.focus({ preventScroll: true });
    if (dialog) dialog.scrollTop = 0;
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      className="carryon-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose?.();
      }}
    >
      {children}
    </dialog>
  );
}
