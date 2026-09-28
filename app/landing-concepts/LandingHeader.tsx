/* eslint-disable next/no-img-element */
'use client';

import { ArrowDown } from 'lucide-react';
import AccountButton from '@/shared/accounts/AccountButton';
import LanguageSwitcher from '@/shared/language/LanguageSwitcher';
import WardrobeButton from '@/shared/wardrobe/WardrobeButton';

export default function LandingHeader({
  gamesLabel,
  conceptLabel,
}: {
  gamesLabel: string;
  conceptLabel: string;
}) {
  return (
    <header className="alt-header">
      <a className="alt-brand" href="/" aria-label="Jumbleyard home">
        <span className="alt-brand-face" aria-hidden="true">
          <img
            src="/images/brand/host-head-header.webp"
            alt=""
            width="46"
            height="46"
          />
          <img
            className="alt-brand-wink"
            src="/images/brand/host-head-wink-header.webp"
            alt=""
            width="46"
            height="46"
          />
        </span>
        <span>jumbleyard</span>
      </a>
      <span className="alt-concept-label">{conceptLabel}</span>
      <div className="alt-header-actions">
        <a className="alt-games-link" href="#games">
          {gamesLabel} <ArrowDown size={15} />
        </a>
        <LanguageSwitcher variant="header" />
        <WardrobeButton variant="header" />
        <AccountButton variant="header" />
      </div>
    </header>
  );
}
