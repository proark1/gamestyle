'use client';

import { useId } from 'react';
import { useLanguage } from '../../shared/language/useLanguage';
import type { CameraMode } from './camera';

export default function CameraSelect({
  mode,
  onChange,
}: {
  mode: CameraMode;
  onChange: (mode: CameraMode) => void;
}) {
  const de = useLanguage().language === 'de';
  const groupName = `reel-camera-${useId()}`;
  return (
    <fieldset className="reel-camera-select">
      <legend>{de ? 'Wähle deine Ansicht' : 'Choose your view'}</legend>
      <label
        aria-label={de ? 'Isometrische Ansicht' : 'Isometric view'}
        className={mode === 'isometric' ? 'selected' : ''}
      >
        <input
          type="radio"
          name={groupName}
          checked={mode === 'isometric'}
          onChange={() => onChange('isometric')}
        />
        <span>
          <b>{de ? 'Isometrisch' : 'Isometric'}</b>
          <small>{de ? 'Sieh das ganze Boot' : 'See the whole boat'}</small>
        </span>
      </label>
      <label
        aria-label={de ? 'Ich-Perspektive' : 'First-person view'}
        className={mode === 'first-person' ? 'selected' : ''}
      >
        <input
          type="radio"
          name={groupName}
          checked={mode === 'first-person'}
          onChange={() => onChange('first-person')}
        />
        <span>
          <b>{de ? 'Ich-Perspektive' : 'First-person'}</b>
          <small>{de ? 'Folge deiner Figur' : 'Follow your angler'}</small>
        </span>
      </label>
    </fieldset>
  );
}
