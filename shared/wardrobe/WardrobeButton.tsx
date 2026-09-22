'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import WardrobeDialog from './WardrobeDialog';
import './wardrobe.css';
import { useLanguage } from '../language/useLanguage';
import { CLUBHOUSE_COPY } from '../clubhouse/copy';

export default function WardrobeButton({
  variant = 'header',
}: {
  variant?: 'header' | 'toolbar';
}) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const label = t(CLUBHOUSE_COPY).wardrobeLabel;

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
        aria-label={label}
        title={label}
      >
        <Sparkles size={variant === 'toolbar' ? 18 : 16} />
        {variant === 'header' && <span>{label}</span>}
      </button>

      {open && <WardrobeDialog open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
