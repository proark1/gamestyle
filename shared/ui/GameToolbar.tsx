'use client';

import { useSyncExternalStore } from 'react';
import { AudioLines, CircleHelp, Radio, Volume2, VolumeX } from 'lucide-react';
import { useLanguage } from '../language/useLanguage';
import VoicePanel from '../voice/VoicePanel';
import HostNotice from '../peer/HostNotice';
import AccountButton from '../accounts/AccountButton';
import WardrobeButton from '../wardrobe/WardrobeButton';
import LanguageSwitcher from '../language/LanguageSwitcher';
import type { VoiceSession, VoiceSnapshot } from '../voice/types';
import {
  applyAudioPreferences,
  audioPreferencesSnapshot,
  defaultAudioPreferences,
  subscribeAudioPreferences,
  type AudioPreferences,
} from '../audio/preferences';
import { useWakeLock } from '../browser/wake-lock';
import './toolbar.css';
import GraphicsControls from '../rendering/GraphicsControls';

const DEFAULT_LABELS = {
  controls: 'Game controls',
  soundOn: 'Enable game sound',
  soundOff: 'Mute game sound',
  musicOn: 'Turn music on',
  musicOff: 'Turn music off',
  volume: 'Sound volume',
  help: 'How to play',
};
export default function GameToolbar({
  labels = DEFAULT_LABELS,
  voice,
  voiceHint,
  onVoice,
  muted,
  onToggleSound,
  onHelp,
  onLeave: _onLeave,
  workshop: _workshop,
}: {
  labels?: typeof DEFAULT_LABELS;
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
  useWakeLock();
  const { language } = useLanguage();
  const de = language === 'de' && labels === DEFAULT_LABELS;
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
    <nav
      className="game-toolbar"
      aria-label={de ? 'Spielsteuerung' : labels.controls}
    >
      <HostNotice
        key={voice?.session.code ?? 'menu'}
        session={voice?.session}
      />
      {onVoice ? (
        <button
          className="game-toolbar-button voice-trigger"
          onClick={onVoice}
          aria-label={de ? 'Sprachchat' : 'Voice chat'}
          title={de ? 'Sprachchat' : 'Voice chat'}
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
        aria-label={
          muted
            ? de
              ? 'Spielton einschalten'
              : labels.soundOn
            : de
              ? 'Spielton stummschalten'
              : labels.soundOff
        }
        title={
          muted
            ? de
              ? 'Spielton einschalten'
              : labels.soundOn
            : de
              ? 'Spielton stummschalten'
              : labels.soundOff
        }
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
        aria-label={de ? 'Lautstärke' : labels.volume}
        title={de ? 'Lautstärke' : labels.volume}
      />
      <button
        className={`game-toolbar-button${audio.music ? '' : ' is-off'}`}
        onClick={() => change({ music: !audio.music })}
        disabled={muted}
        aria-label={
          audio.music
            ? de
              ? 'Musik ausschalten'
              : labels.musicOff
            : de
              ? 'Musik einschalten'
              : labels.musicOn
        }
        title={
          audio.music
            ? de
              ? 'Musik ausschalten'
              : labels.musicOff
            : de
              ? 'Musik einschalten'
              : labels.musicOn
        }
        aria-pressed={audio.music}
      >
        <AudioLines size={19} />
      </button>
      <WardrobeButton variant="toolbar" />

      <AccountButton variant="toolbar" />
      <LanguageSwitcher variant="toolbar" />
      <GraphicsControls />
      <button
        className="game-toolbar-button"
        onClick={onHelp}
        aria-label={de ? 'So wird gespielt' : labels.help}
        title={de ? 'So wird gespielt' : labels.help}
      >
        <CircleHelp size={19} />
      </button>
    </nav>
  );
}
