/* eslint-disable next/no-img-element -- Reuse the established brand head assets. */
'use client';

import {
  ArrowDown,
  ArrowUpRight,
  Gamepad2,
  SkipForward,
  Trophy,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useLanguage } from '@/shared/language/useLanguage';
import { CLUBHOUSE_COPY } from '@/shared/clubhouse/copy';
import EnhancedMedia from './EnhancedMedia';
import YardPath from './YardPath';
import { ENHANCED_LANDING_COPY } from './copy';

const SECTION_TARGETS = [
  { selector: '.clubhouse-hero', id: 'clubhouse-title' },
  { selector: '.adventure-desk', id: 'enhanced-adventure' },
  { selector: '.clubhouse-party', id: 'enhanced-party' },
  { selector: '.clubhouse-shelf-heading', id: 'games' },
] as const;

export default function EnhancedStandardShell({
  children,
  poster,
  src,
  variant,
}: {
  children: ReactNode;
  poster: string;
  src: string;
  variant: 'living' | 'trailer';
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const pendingPointer = useRef({ x: 0, y: 0 });
  const [activeSection, setActiveSection] = useState('clubhouse-title');
  const [entered, setEntered] = useState(variant === 'living');
  const { t } = useLanguage();
  const copy = t(ENHANCED_LANDING_COPY);
  const clubhouse = t(CLUBHOUSE_COPY);

  const enterTrailer = useCallback((moveFocus = false) => {
    setEntered(true);
    if (!moveFocus) return;
    window.setTimeout(() => {
      const heading = document.getElementById('clubhouse-title');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
    }, 460);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const elements = SECTION_TARGETS.flatMap(({ selector, id }) => {
      const element = root.querySelector<HTMLElement>(selector);
      if (!element) return [];
      if (id !== 'clubhouse-title') element.id = id;
      if (id !== 'clubhouse-title') element.classList.add('enhanced-reveal');
      return [{ element, id }];
    });

    if (reducedMotion) {
      elements.forEach(({ element }) => element.classList.add('is-revealed'));
      const frame = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(frame);
    }

    root.dataset.motionReady = 'true';
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const match = elements.find(
            ({ element }) => element === entry.target,
          );
          if (!match) return;
          match.element.classList.add('is-revealed');
          setActiveSection(match.id);
        });
      },
      { rootMargin: '-28% 0px -55% 0px', threshold: 0.02 },
    );
    elements.forEach(({ element }) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (variant !== 'trailer' || entered) return;
    const onScroll = () => {
      if (window.scrollY > 44) enterTrailer(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enterTrailer, entered, variant]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const updatePointer = (event: PointerEvent<HTMLDivElement>) => {
    if (variant !== 'living' || event.pointerType === 'touch') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pendingPointer.current = {
      x: (event.clientX - bounds.left) / bounds.width - 0.5,
      y: (event.clientY - bounds.top) / bounds.height - 0.5,
    };
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      const root = rootRef.current;
      if (root) {
        root.style.setProperty('--yard-x', `${pendingPointer.current.x}`);
        root.style.setProperty('--yard-y', `${pendingPointer.current.y}`);
      }
      frameRef.current = null;
    });
  };

  return (
    <div
      ref={rootRef}
      className={`enhanced-standard ${variant === 'living' ? 'living-clubhouse' : 'clubhouse-trailer'} ${entered ? 'is-entered' : ''}`}
      onPointerMove={updatePointer}
      data-variant={variant}
    >
      {variant === 'living' ? (
        <EnhancedMedia
          className="living-clubhouse-media"
          poster={poster}
          src={src}
          loop
        />
      ) : (
        <section className="trailer-intro" aria-label={copy.trailerKicker}>
          <EnhancedMedia
            className="trailer-media"
            poster={poster}
            src={src}
            loop={false}
            onEnded={() => enterTrailer(false)}
          />
          <div className="trailer-shade" aria-hidden="true" />
          <header className="trailer-header">
            <a className="trailer-brand" href="/" aria-label="Jumbleyard home">
              <img
                src="/images/brand/host-head-header.webp"
                alt=""
                width="46"
                height="46"
              />
              <span>jumbleyard</span>
            </a>
            <button type="button" onClick={() => enterTrailer(true)}>
              {copy.skip} <SkipForward size={17} />
            </button>
          </header>
          <div className="trailer-copy">
            <p>{copy.trailerKicker}</p>
            <p className="trailer-title">
              {clubhouse.heroTop}
              <br />
              <em>{clubhouse.heroBottom}</em>
            </p>
            <span>{clubhouse.intro}</span>
            <div className="trailer-actions">
              <a href="#games" onClick={() => enterTrailer(false)}>
                <Gamepad2 size={19} /> {clubhouse.pick} <ArrowDown size={17} />
              </a>
              <a href="/party">
                <Trophy size={18} /> {clubhouse.party}
              </a>
              <button type="button" onClick={() => enterTrailer(true)}>
                {copy.enter} <ArrowUpRight size={18} />
              </button>
            </div>
          </div>
          <div className="trailer-progress" aria-label={copy.progress}>
            <i />
          </div>
        </section>
      )}

      <div
        className="enhanced-standard-content"
        inert={variant === 'trailer' && !entered}
      >
        {children}
      </div>

      <YardPath active={activeSection} copy={copy} />
    </div>
  );
}
