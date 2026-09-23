'use client';
/* oxlint-disable next/no-img-element -- Static WebP cutouts are pre-optimized with explicit dimensions. */

import { useLanguage } from '../language/useLanguage';
import { CLUBHOUSE_COPY } from './copy';
import './clubhouse.css';

export type CastPose =
  | 'wave'
  | 'point'
  | 'cheer'
  | 'mail'
  | 'game-scout'
  | 'explorer'
  | 'play-laugh'
  | 'party-host'
  | 'stylist';

/** Decorative cast: instructions remain ordinary, translated page text. */
export function Cast({
  pose,
  className = '',
  eager = false,
}: {
  pose: CastPose;
  className?: string;
  eager?: boolean;
}) {
  return (
    <img
      className={`clay-cast ${className}`}
      src={`/images/clubhouse/${pose}.webp`}
      width={560}
      height={840}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}

export function CastGuide({
  message,
  pose = 'point',
  className = '',
}: {
  message:
    | 'signIn'
    | 'code'
    | 'account'
    | 'wardrobe'
    | 'partyEntry'
    | 'partyWaiting'
    | 'partyReady'
    | 'shelfHint';
  pose?: CastPose;
  className?: string;
}) {
  const { t } = useLanguage();
  return (
    <div className={`cast-guide ${className}`}>
      <Cast pose={pose} />
      <p className="cast-speech">{t(CLUBHOUSE_COPY)[message]}</p>
    </div>
  );
}
