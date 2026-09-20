'use client';
import { Dialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';

export function StampedeModal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close?: () => void;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close?.();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="stampede-dialog-backdrop" />
        <Dialog.Popup
          className="stampede-modal-card stampede-dialog"
          aria-describedby={undefined}
        >
          <Dialog.Title>{title}</Dialog.Title>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
