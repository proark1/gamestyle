'use client';
import { useSyncExternalStore } from 'react';
import { Monitor } from 'lucide-react';
import { useLanguage } from '../language/useLanguage';
import {
  graphicsPreferences,
  defaultGraphicsPreferences,
  subscribeGraphicsPreferences,
  setGraphicsPreferences,
  type GraphicsPreferences,
} from './preferences';
export default function GraphicsControls() {
  const { language } = useLanguage();
  const de = language === 'de';
  const value = useSyncExternalStore(
    subscribeGraphicsPreferences,
    graphicsPreferences,
    defaultGraphicsPreferences,
  );
  return (
    <details className="game-graphics-controls">
      <summary
        className="game-toolbar-button"
        aria-label={de ? 'Grafik' : 'Graphics'}
        title={de ? 'Grafik' : 'Graphics'}
      >
        <Monitor size={19} />
        <span className="graphics-label">{de ? 'Grafik' : 'Graphics'}</span>
      </summary>
      <div className="game-graphics-panel">
        <label>
          {de ? 'Qualität' : 'Quality'}{' '}
          <select
            value={value.quality}
            onChange={(e) =>
              setGraphicsPreferences({
                ...value,
                quality: e.target.value as GraphicsPreferences['quality'],
              })
            }
          >
            <option value="auto">{de ? 'Automatisch' : 'Automatic'}</option>
            <option value="low">
              {de ? 'Energiesparend' : 'Battery saver'}
            </option>
            <option value="high">{de ? 'Volle Details' : 'Full detail'}</option>
          </select>
        </label>{' '}
        <label>
          {de ? 'Bildrate' : 'Frame limit'}{' '}
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
