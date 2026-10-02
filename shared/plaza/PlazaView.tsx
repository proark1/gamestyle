'use client';
/* oxlint-disable react/react-compiler */
import { useEffect, useRef, useState } from 'react';
import type { Look } from '../wardrobe/look';
import type { PlazaPerson, PlazaScene } from './scene';
import type { PlazaPose, PlazaStation } from './world';
import './plaza.css';

export default function PlazaView(props: {
  self: string;
  players: PlazaPerson[];
  look: Look;
  paused: boolean;
  onPose: (pose: PlazaPose) => void;
  onOpen: (station: PlazaStation) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<PlazaScene | null>(null),
    latest = useRef(props);
  const [station, setStation] = useState<PlazaStation | null>(null);
  const [status, setStatus] = useState('Opening the plaza…');
  useEffect(() => {
    latest.current = props;
    scene.current?.update(props.players, props.look, props.paused);
  }, [props]);
  useEffect(() => {
    let disposed = false;
    void import('./scene')
      .then(({ createPlazaScene }) => {
        if (disposed || !host.current) return;
        const value = latest.current;
        scene.current = createPlazaScene(
          host.current,
          value.self,
          value.players,
          (pose) => latest.current.onPose(pose),
          setStation,
          (place) => latest.current.onOpen(place),
        );
        scene.current.update(value.players, value.look, value.paused);
        setStatus('');
      })
      .catch(() => {
        if (!disposed)
          setStatus(
            'The 3D plaza is unavailable on this device. Use the shop and play buttons below.',
          );
      });
    return () => {
      disposed = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [props.self]);

  return (
    <div className="plaza-view">
      <div className="plaza-canvas" ref={host} />
      {status && <output className="plaza-loading">{status}</output>}
      <div className="plaza-controls">
        <div className="plaza-dpad" aria-label="Walk around the plaza">
          {[
            { label: 'Walk left', symbol: '←', x: -1, z: 0 },
            { label: 'Walk up', symbol: '↑', x: 0, z: -1 },
            { label: 'Walk down', symbol: '↓', x: 0, z: 1 },
            { label: 'Walk right', symbol: '→', x: 1, z: 0 },
          ].map((direction) => (
            <button
              key={direction.label}
              type="button"
              disabled={props.paused || !!status}
              aria-label={direction.label}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                scene.current?.direction(direction.x, direction.z);
              }}
              onPointerUp={() => scene.current?.direction(0, 0)}
              onPointerCancel={() => scene.current?.direction(0, 0)}
              onLostPointerCapture={() => scene.current?.direction(0, 0)}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  scene.current?.direction(direction.x, direction.z);
                }
              }}
              onKeyUp={() => scene.current?.direction(0, 0)}
              onBlur={() => scene.current?.direction(0, 0)}
            >
              {direction.symbol}
            </button>
          ))}
        </div>
        <p>
          Click to walk · WASD / arrows{' '}
          <span>Meet your friends, browse, and try something on.</span>
        </p>
        {station && (
          <button
            type="button"
            className="plaza-interact"
            disabled={props.paused}
            onClick={() => scene.current?.interact()}
          >
            {station.id === 'play' ? 'Get ready' : 'Browse here'} <kbd>E</kbd>
          </button>
        )}
      </div>
    </div>
  );
}
