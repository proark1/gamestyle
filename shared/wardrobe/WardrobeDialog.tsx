'use client';

import { Dialog } from '@base-ui/react/dialog';
import WardrobeView from './WardrobeView';
import './wardrobe.css';
import { CastGuide } from '../clubhouse/Cast';
import type { Slot } from './catalog';

export default function WardrobeDialog({
  open,
  onClose,
  initialSlot,
  initialItemId,
}: {
  open: boolean;
  onClose: () => void;
  initialSlot?: Slot | 'all';
  initialItemId?: string;
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
          <CastGuide
            pose="wave"
            message="wardrobe"
            className="wardrobe-cast-guide"
          />
          <WardrobeView
            onClose={onClose}
            initialSlot={initialSlot}
            initialItemId={initialItemId}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
