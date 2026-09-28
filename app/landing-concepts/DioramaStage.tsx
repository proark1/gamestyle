'use client';

import { useRef, type ReactNode } from 'react';

export default function DioramaStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={stageRef}
      className="toybox-stage"
      onPointerMove={(event) => {
        const stage = stageRef.current;
        if (!stage) return;
        const rect = stage.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        stage.style.setProperty('--stage-x', x.toFixed(3));
        stage.style.setProperty('--stage-y', y.toFixed(3));
      }}
      onPointerLeave={() => {
        const stage = stageRef.current;
        if (!stage) return;
        stage.style.setProperty('--stage-x', '0');
        stage.style.setProperty('--stage-y', '0');
      }}
    >
      {children}
    </div>
  );
}
