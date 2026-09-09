import type { FarmMode } from './types';

export function ModePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: FarmMode;
  onChange: (mode: FarmMode) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="farm-mode-picker" disabled={disabled}>
      <legend>WHO IS THE FARMER?</legend>
      {(
        [
          [
            'computer',
            'Escape the computer',
            '1–4 players · everyone is a cow',
          ],
          ['human', 'Player farmer', 'Night hunt · friends or NPC cows'],
        ] as const
      ).map(([mode, title, description]) => (
        <label
          key={mode}
          aria-label={title}
          className={value === mode ? 'selected' : ''}
        >
          <input
            type="radio"
            name="farm-mode"
            value={mode}
            checked={value === mode}
            onChange={() => onChange(mode)}
          />
          <span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
