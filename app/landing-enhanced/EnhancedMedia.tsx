/* eslint-disable next/no-img-element -- Local generated media needs native video poster layering. */
'use client';

import { useEffect, useRef, useState } from 'react';

export default function EnhancedMedia({
  className,
  poster,
  src,
  loop,
  onEnded,
}: {
  className: string;
  poster: string;
  src: string;
  loop: boolean;
  onEnded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'poster' | 'playing' | 'failed'>('poster');

  useEffect(() => {
    const video = videoRef.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!video || motion.matches) return;

    let active = true;
    void video.play().catch(() => {
      if (active) setState('failed');
    });
    return () => {
      active = false;
      video.pause();
    };
  }, []);

  return (
    <div
      className={`enhanced-media ${className}`}
      data-media-state={state}
      aria-hidden="true"
    >
      <img src={poster} alt="" width="1280" height="720" />
      <video
        ref={videoRef}
        muted
        playsInline
        loop={loop}
        preload="metadata"
        poster={poster}
        onCanPlay={() => setState('playing')}
        onEnded={onEnded}
        onError={() => setState('failed')}
      >
        <source src={src} type="video/mp4" onError={() => setState('failed')} />
      </video>
    </div>
  );
}
