/* eslint-disable next/no-img-element */
'use client';

import { useState } from 'react';

export default function GameArtwork({
  src,
  alt,
  title,
  className,
  eager = false,
}: {
  src: string;
  alt: string;
  title: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`alt-art-fallback ${className ?? ''}`}
        aria-hidden="true"
      >
        <span>JY</span>
        <strong>{title}</strong>
      </span>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      width="1536"
      height="1024"
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      onError={() => setFailed(true)}
    />
  );
}
