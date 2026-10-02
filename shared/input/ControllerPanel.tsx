'use client';
import { useEffect, useState } from 'react';
import { controllerMapping, GAMEPAD_BUTTONS } from './gamepad';
import { inPartyMode } from '../ui/party-mode';
import { useLanguage } from '../language/useLanguage';
export default function ControllerPanel() {
  const { language } = useLanguage();
  const [state, setState] = useState({ connected: false, menu: true });
  const [mapping, setMapping] = useState<string[]>([]);
  useEffect(() => {
    const changed = (event: Event) => {
      setState((event as CustomEvent<typeof state>).detail);
      setMapping(controllerMapping());
    };
    window.addEventListener('game:controller', changed);
    return () => window.removeEventListener('game:controller', changed);
  }, []);
  if (!state.connected) return null;
  return (
    <details
      className="controller-panel"
      open={state.menu}
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 10000,
        maxHeight: '75vh',
        overflow: 'auto',
        padding: 12,
        background: '#fff6df',
        color: '#294a43',
        borderRadius: 12,
      }}
    >
      <summary>Controller · Start: play/menu</summary>
      <p>D-pad: navigate · A: choose · Left stick: move</p>
      <button
        onClick={() => {
          (document.activeElement as HTMLElement)?.blur();
          window.dispatchEvent(
            new CustomEvent('game:controller-mode', { detail: false }),
          );
        }}
      >
        Play
      </button>{' '}
      {inPartyMode() ? (
        <button
          onClick={() => {
            window.parent.postMessage(
              {
                type: 'party-open-menu',
                code: new URLSearchParams(location.search)
                  .get('party')
                  ?.toUpperCase(),
              },
              location.origin,
            );
          }}
        >
          {language === 'de' ? 'Partymenü' : 'Party menu'}
        </button>
      ) : (
        <a href="/">Collection</a>
      )}
      <p>
        Match the actions shown in this game’s help. Bindings are saved for this
        game.
      </p>
      {GAMEPAD_BUTTONS.map((label, i) => (
        <label key={label} style={{ display: 'block' }}>
          {label}{' '}
          <select
            value={mapping[i] ?? ''}
            onChange={(e) => {
              const next = [...mapping];
              next[i] = e.target.value;
              setMapping(next);
              try {
                localStorage.setItem(
                  `gamepad:${location.pathname}`,
                  JSON.stringify(next),
                );
              } catch {
                /* Optional storage. */
              }
              window.dispatchEvent(new Event('game:controller-mapping'));
            }}
          >
            {[
              'Space',
              'ShiftLeft',
              'Tab',
              ...Array.from(
                { length: 26 },
                (_, j) => 'Key' + String.fromCharCode(65 + j),
              ),
              ...Array.from({ length: 10 }, (_, j) => 'Digit' + j),
              'ArrowUp',
              'ArrowDown',
              'ArrowLeft',
              'ArrowRight',
            ].map((key) => (
              <option key={key}>{key}</option>
            ))}
          </select>
        </label>
      ))}
    </details>
  );
}
