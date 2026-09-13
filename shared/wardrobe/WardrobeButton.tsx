'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import WardrobeDialog from './WardrobeDialog';
import './wardrobe.css';

export default function WardrobeButton({
  variant = 'header',
}: {
  variant?: 'header' | 'toolbar';
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={
          variant === 'toolbar'
            ? 'game-toolbar-button wardrobe-toolbar-button'
            : 'wardrobe-header-button'
        }
        onClick={() => setOpen(true)}
        aria-label="Wardrobe & Perks"
        title="Wardrobe & Perks"
      >
        <Sparkles size={variant === 'toolbar' ? 18 : 16} />
        {variant === 'header' && <span>Wardrobe & Perks</span>}
      </button>

      {open && <WardrobeDialog open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
