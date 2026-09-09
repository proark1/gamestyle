'use client';

import {
  BookOpen,
  Camera,
  Construction,
  Eye,
  Hammer,
  Hand,
  Maximize,
  MousePointer2,
  Send,
  Settings2,
  Smile,
  Volume2,
  VolumeX,
} from 'lucide-react';

type Props = {
  building: boolean;
  catalogOpen: boolean;
  removing: boolean;
  crane: boolean;
  firstPerson: boolean;
  sound: boolean;
  holding: boolean;
  canGrab: boolean;
  canUse: boolean;
  useLabel: string;
  onWalk: () => void;
  onBuild: () => void;
  onRemove: () => void;
  onAction: (action: string) => void;
  onView: () => void;
  onPhoto: () => void;
  onHelp: () => void;
  onSound: () => void;
  onSettings: () => void;
};

export function SiteTools(p: Props) {
  return (
    <div className="site-tools">
      <nav className="site-modes" aria-label="Site tools" inert={p.crane}>
        <button
          className={!p.building && !p.removing ? 'active' : ''}
          aria-pressed={!p.building && !p.removing}
          onClick={p.onWalk}
          title="Walk · WASD"
        >
          <MousePointer2 size={18} />
          <span>Walk</span>
        </button>
        <button
          className={p.building ? 'active' : ''}
          aria-pressed={p.building}
          aria-expanded={p.building && p.catalogOpen}
          aria-controls={
            p.building && p.catalogOpen ? 'building-kit' : undefined
          }
          onClick={p.onBuild}
          title="Building kit · B"
        >
          <Hammer size={18} />
          <span>Build</span>
        </button>
        <button
          className={p.removing ? 'active danger-tool' : ''}
          aria-pressed={p.removing}
          onClick={p.onRemove}
          title="Remove a part · Delete"
        >
          <Construction size={18} />
          <span>Remove</span>
        </button>
      </nav>
      <nav className="site-actions" aria-label="Object actions" inert={p.crane}>
        <button
          disabled={!p.canGrab}
          onClick={() => p.onAction('grab')}
          title={
            p.canGrab
              ? 'Pick up or put down · E'
              : 'Walk up to an object or click it'
          }
        >
          <Hand size={17} />
          <span>{p.holding ? 'Put down' : 'Pick up'}</span>
        </button>
        <button
          disabled={!p.holding}
          onClick={() => p.onAction('throw')}
          title={p.holding ? 'Throw · F' : 'Pick up an object first'}
        >
          <Send size={17} />
          <span>Throw</span>
        </button>
        <button
          disabled={!p.canUse}
          onClick={() => p.onAction('use')}
          title={`${p.useLabel} · X`}
        >
          <Hand size={17} />
          <span>{p.useLabel}</span>
        </button>
        <button onClick={() => p.onAction('emote')} title="Shout an excuse · Q">
          <Smile size={17} />
          <span>Excuse</span>
        </button>
      </nav>
      <nav className="site-utilities" aria-label="View, crane and settings">
        <button
          className={p.firstPerson ? 'active' : ''}
          aria-pressed={p.firstPerson}
          disabled={p.crane}
          aria-label={
            p.firstPerson
              ? 'Switch to overhead view'
              : 'Switch to first-person view'
          }
          title={p.firstPerson ? 'Overhead view · V' : 'First-person view · V'}
          onClick={p.onView}
        >
          <Eye size={19} />
        </button>
        <button
          className={p.crane ? 'active' : ''}
          aria-pressed={p.crane}
          aria-label="Use roof crane"
          title="Roof crane · C"
          onClick={() => p.onAction('crane')}
        >
          <Construction size={19} />
        </button>
        <button
          aria-label="Save site photo"
          title="Save site photo"
          onClick={p.onPhoto}
        >
          <Camera size={19} />
        </button>
        <button aria-label="How to play" title="How to play" onClick={p.onHelp}>
          <BookOpen size={19} />
        </button>
        <button
          aria-label="Fullscreen"
          title="Fullscreen"
          onClick={() =>
            document.documentElement.requestFullscreen?.().catch(() => {})
          }
        >
          <Maximize size={19} />
        </button>
        <button
          aria-label={p.sound ? 'Mute sound' : 'Enable sound'}
          title={p.sound ? 'Mute sound' : 'Enable sound'}
          onClick={p.onSound}
        >
          {p.sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
        <button aria-label="Settings" title="Settings" onClick={p.onSettings}>
          <Settings2 size={19} />
        </button>
      </nav>
    </div>
  );
}
