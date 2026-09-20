'use client';

import { Dialog } from '@base-ui/react/dialog';
import WardrobeView from './WardrobeView';
import './wardrobe.css';
import { CastGuide } from '../clubhouse/Cast';

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
          <CastGuide
            pose="cheer"
            message="wardrobe"
            className="wardrobe-cast-guide"
          />
          <WardrobeView onClose={onClose} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
