'use client';

import { useSyncExternalStore } from 'react';
import {
  AudioLines,
  CircleHelp,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react';
import VoicePanel from '../voice/VoicePanel';
import HostNotice from '../peer/HostNotice';
import AccountButton from '../accounts/AccountButton';
import type { VoiceSession, VoiceSnapshot } from '../voice/types';
import {
  applyAudioPreferences,
  audioPreferencesSnapshot,
  defaultAudioPreferences,
  subscribeAudioPreferences,
  type AudioPreferences,
} from '../audio/preferences';
import './toolbar.css';

export default function GameToolbar({
  voice,
  voiceHint,
  onVoice,
  muted,
  onToggleSound,
  onHelp,
  onLeave: _onLeave,
  workshop: _workshop,
}: {
  voice?: {
    session: VoiceSession;
    snapshot: VoiceSnapshot;
    onSpeaking?: (active: boolean) => void;
  };
  voiceHint?: string;
  onVoice?: () => void;
  muted: boolean;
  onToggleSound: () => void;
  onHelp: () => void;
  onLeave?: () => void;
  workshop?: string;
}) {
  // Stored preferences are external state: the server and the hydrating client
  // both see the defaults, then React re-reads once hydration finishes.
  const audio = useSyncExternalStore(
    subscribeAudioPreferences,
    audioPreferencesSnapshot,
    defaultAudioPreferences,
  );
  // Merge against live state, not the render snapshot, so batched changes do not
  // overwrite one another.
  const change = (patch: Partial<AudioPreferences>) =>
    applyAudioPreferences({ ...audioPreferencesSnapshot(), ...patch });
  return (
    <nav className="game-toolbar" aria-label="Game controls">
      <HostNotice
        key={voice?.session.code ?? 'menu'}
        session={voice?.session}
      />
      {onVoice ? (
        <button
          className="game-toolbar-button voice-trigger"
          onClick={onVoice}
          aria-label="Voice chat"
          title="Voice chat"
        >
          <Radio size={18} /> <span>Voice</span>
        </button>
      ) : (
        <VoicePanel
          key={
            voice
              ? `${voice.session.game}:${voice.session.code}:${voice.session.id}:${voice.session.token}`
              : 'offline'
          }
          {...voice}
          unavailableReason={voiceHint}
        />
      )}
      <button
        className="game-toolbar-button"
        onClick={onToggleSound}
        aria-label={muted ? 'Enable game sound' : 'Mute game sound'}
        title={muted ? 'Enable game sound' : 'Mute game sound'}
        aria-pressed={muted}
      >
        {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
      </button>
      <input
        className="game-toolbar-volume"
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(audio.volume * 100)}
        disabled={muted}
        onChange={(event) =>
          change({ volume: Number(event.target.value) / 100 })
        }
        aria-label="Sound volume"
        title="Sound volume"
      />
      <button
        className={`game-toolbar-button${audio.music ? '' : ' is-off'}`}
        onClick={() => change({ music: !audio.music })}
        disabled={muted}
        aria-label={audio.music ? 'Turn music off' : 'Turn music on'}
        title={audio.music ? 'Turn music off' : 'Turn music on'}
        aria-pressed={audio.music}
      >
        <AudioLines size={19} />
      </button>
      <AccountButton variant="toolbar" />
      <button
        className="game-toolbar-button"
        onClick={onHelp}
        aria-label="How to play"
        title="How to play"
      >
        <CircleHelp size={19} />
      </button>
    </nav>
  );
}
