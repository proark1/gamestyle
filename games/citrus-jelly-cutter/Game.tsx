'use client';

import { useEffect, useRef } from 'react';
import { SessionTracker } from '../../shared/analytics/tracker';
import { citrusJellyAnalytics } from './analytics';
import { citrusMessage } from './bridge';

const tracker = new SessionTracker(citrusJellyAnalytics);

export default function CitrusJellyGame() {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    tracker.start();
    tracker.observe({
      stage: 'lobby',
      mode: 'solo',
      room: 'PRACTICE',
      humans: 1,
      npcs: 0,
      round: 1,
    });
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frame.current?.contentWindow) return;
      const message = citrusMessage(event.data);
      if (!message) return;
      if (message.kind === 'ready')
        tracker.observe({
          stage: 'playing',
          mode: 'solo',
          room: 'PRACTICE',
          humans: 1,
          npcs: 0,
          round: 1,
        });
      else if (message.kind === 'action') tracker.action(message.key);
      else tracker.milestone(message.key);
    };
    window.addEventListener('message', receive);
    return () => {
      window.removeEventListener('message', receive);
      tracker.stop();
    };
  }, []);

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#f2ece2',
      }}
    >
      <iframe
        ref={frame}
        src="/citrus-jelly-cutter.html"
        title="Citrus Jelly — Knife & Cookie Cutters"
        allow="fullscreen"
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
      />
    </main>
  );
}
