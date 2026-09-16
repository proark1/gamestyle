'use client';

import { Dialog } from '@base-ui/react/dialog';
import WardrobeView from './WardrobeView';
import './wardrobe.css';

export default function WardrobeDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="wardrobe-backdrop" />
        <Dialog.Popup
          className="wardrobe-dialog"
          aria-modal="true"
          aria-labelledby="wardrobe-dialog-title"
        >
          <WardrobeView onClose={onClose} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
