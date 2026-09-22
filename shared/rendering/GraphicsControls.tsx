'use client';
import { useSyncExternalStore } from 'react';
import { Monitor } from 'lucide-react';
import {
  graphicsPreferences,
  defaultGraphicsPreferences,
  subscribeGraphicsPreferences,
  setGraphicsPreferences,
  type GraphicsPreferences,
} from './preferences';
export default function GraphicsControls() {
  const value = useSyncExternalStore(
    subscribeGraphicsPreferences,
    graphicsPreferences,
    defaultGraphicsPreferences,
  );
  return (
    <details className="game-graphics-controls">
      <summary
        className="game-toolbar-button"
        aria-label="Graphics"
        title="Graphics"
      >
        <Monitor size={19} />
        <span className="graphics-label">Graphics</span>
      </summary>
      <div className="game-graphics-panel">
        <label>
          Quality{' '}
          <select
            value={value.quality}
            onChange={(e) =>
              setGraphicsPreferences({
                ...value,
                quality: e.target.value as GraphicsPreferences['quality'],
              })
            }
          >
            <option value="auto">Automatic</option>
            <option value="low">Battery saver</option>
            <option value="high">Full detail</option>
          </select>
        </label>{' '}
        <label>
          Frame limit{' '}
          <select
            value={value.fps}
            onChange={(e) =>
              setGraphicsPreferences({
                ...value,
                fps: Number(e.target.value) as GraphicsPreferences['fps'],
              })
            }
          >
            <option value={30}>30 FPS</option>
            <option value={60}>60 FPS</option>
            <option value={120}>120 FPS</option>
          </select>
        </label>
      </div>
    </details>
  );
}
