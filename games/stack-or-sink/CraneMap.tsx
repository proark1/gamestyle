import type { MouseEvent } from 'react';
import {
  CRANE_MAP_EXTENT,
  mapToCranePoint,
  type CranePoint,
} from './crane-guide';
import { dimensions, type Piece } from './types';

type Props = {
  pieces: Piece[];
  cargo: string | null;
  position: CranePoint;
  destination: CranePoint | null;
  onTarget: (point: CranePoint) => void;
};

const percent = (value: number) => `${50 + (value / CRANE_MAP_EXTENT) * 50}%`;

export function CraneMap({
  pieces,
  cargo,
  position,
  destination,
  onTarget,
}: Props) {
  function choose(event: MouseEvent<HTMLButtonElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x =
      event.detail === 0 ? 0.5 : (event.clientX - bounds.left) / bounds.width;
    const y =
      event.detail === 0 ? 0.5 : (event.clientY - bounds.top) / bounds.height;
    onTarget(mapToCranePoint(x, y));
  }

  return (
    <div className="crane-map" aria-label="Crane controls">
      <div className="crane-map-heading">
        <strong>XY map</strong>
        <span>Tap to move</span>
      </div>
      <button
        className="crane-map-field"
        type="button"
        onClick={choose}
        aria-label="Choose crane destination on XY map"
      >
        <span className="crane-map-deck" />
        {pieces
          .filter((piece) => piece.id !== cargo && !piece.heldBy)
          .map((piece) => {
            const footprint = dimensions(piece);
            return (
              <span
                key={piece.id}
                className="crane-map-piece"
                style={{
                  left: percent(piece.x),
                  top: percent(piece.z),
                  width: `${(footprint.w / (CRANE_MAP_EXTENT * 2)) * 100}%`,
                  height: `${(footprint.d / (CRANE_MAP_EXTENT * 2)) * 100}%`,
                }}
              />
            );
          })}
        {destination && (
          <span
            className="crane-map-destination"
            style={{
              left: percent(destination.x),
              top: percent(destination.z),
            }}
          />
        )}
        <span
          className="crane-map-load"
          style={{ left: percent(position.x), top: percent(position.z) }}
        />
      </button>
      <div className="crane-map-foot">
        <span>← X →</span>
        <span>↑ Z ↓</span>
      </div>
    </div>
  );
}
