'use client';
import { useLanguage } from '../../shared/language/useLanguage';
export default function ContractSelect({
  mode,
  onChange,
}: {
  mode: 'classic' | 'campaign';
  onChange: (mode: 'classic' | 'campaign') => void;
}) {
  const de = useLanguage().language === 'de';
  return (
    <fieldset className="reel-contracts">
      <legend>{de ? 'Wähle deinen Ausflug' : 'Choose your trip'}</legend>
      <label
        aria-label={de ? 'Letztes Boot nach Hause' : 'Last Boat Home'}
        className={mode === 'campaign' ? 'selected' : ''}
      >
        <input
          type="radio"
          name="reel-mode"
          checked={mode === 'campaign'}
          onChange={() => onChange('campaign')}
        />
        <span>
          <b>{de ? 'Letztes Boot nach Hause' : 'Last Boat Home'}</b>
          <small>
            {de
              ? 'Riesenfisch · Sturmflucht · Gemeinsam überleben'
              : 'Giant fish · Storm escape · Survive together'}
          </small>
        </span>
      </label>
      <label
        aria-label={de ? 'Klassisches Turnier' : 'Classic tournament'}
        className={mode === 'classic' ? 'selected' : ''}
      >
        <input
          type="radio"
          name="reel-mode"
          checked={mode === 'classic'}
          onChange={() => onChange('classic')}
        />
        <span>
          <b>{de ? 'Klassisches Turnier' : 'Classic tournament'}</b>
          <small>
            {de ? '5 Minuten Angelchaos' : '5 minutes of fishing mayhem'}
          </small>
        </span>
      </label>
    </fieldset>
  );
}
