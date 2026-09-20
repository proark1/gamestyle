'use client';

import { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { useLanguage } from './useLanguage';
import './language.css';

export default function LanguageSwitcher({
  variant = 'header',
}: {
  variant?: 'header' | 'toolbar';
}) {
  const { language, setLanguage, supportedLanguages } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const activeOption =
    supportedLanguages.find((l) => l.code === language) ??
    supportedLanguages[0];

  return (
    <div className="language-switcher" ref={containerRef}>
      {variant === 'toolbar' ? (
        <button
          type="button"
          className="game-toolbar-button language-toolbar-button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`${language === 'de' ? 'Sprache ändern (aktuell' : 'Change language (currently'} ${activeOption.label})`}
          title={`${language === 'de' ? 'Sprache' : 'Language'}: ${activeOption.label}`}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <Globe size={18} />
          <span className="language-toolbar-badge">
            {activeOption.shortLabel}
          </span>
        </button>
      ) : (
        <button
          type="button"
          className="language-header-button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`${language === 'de' ? 'Sprache ändern (aktuell' : 'Change language (currently'} ${activeOption.label})`}
          title={`${language === 'de' ? 'Sprache' : 'Language'}: ${activeOption.label}`}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <Globe size={15} />
          <span className="language-header-code">
            {activeOption.shortLabel}
          </span>
        </button>
      )}

      {open && (
        <div
          className="language-menu"
          role="menu"
          aria-label={language === 'de' ? 'Sprache wählen' : 'Select language'}
        >
          {supportedLanguages.map((option) => {
            const isSelected = option.code === language;
            return (
              <button
                key={option.code}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                className={`language-menu-item ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setLanguage(option.code);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {isSelected ? (
                  <Check size={14} />
                ) : (
                  <span className="item-short">{option.shortLabel}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
