'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Headphones, LoaderCircle, Mic, MicOff, Radio } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { VoiceClient } from './peer-client';
import type { VoiceState } from './types';
import type { VoiceSession, VoiceSnapshot } from './types';
import './voice.css';
import MicrophoneCheck from './MicrophoneCheck';
import { bindPushToTalk } from './push-to-talk';
import {
  voiceControls,
  serverControls,
  subscribeControls,
  saveControls,
} from './preferences';
const initial: VoiceState = {
  status: 'Voice off',
  connected: false,
  mic: false,
  speaking: [],
  level: 0,
};
const emptySnapshot: VoiceSnapshot = { players: [], nearby: false };
const ignoreSpeaking = (_active: boolean) => {};
export type VoiceController = Pick<
  VoiceClient,
  | 'state'
  | 'connect'
  | 'dispose'
  | 'microphone'
  | 'prepareMicrophone'
  | 'setTalking'
  | 'devices'
  | 'resumeAudio'
  | 'update'
  | 'volume'
  | 'deafen'
> &
  Partial<
    Pick<
      VoiceClient,
      | 'capture'
      | 'captureStream'
      | 'outputs'
      | 'outputDevice'
      | 'supportsOutputSelection'
    >
  > & {
    hold?: (source: string, active: boolean) => void;
  };
export default function VoicePanel({
  session,
  snapshot = emptySnapshot,
  onSpeaking = ignoreSpeaking,
  onClient,
  onState,
  unavailableReason = 'Create or join a multiplayer room to talk with friends.',
}: {
  session?: VoiceSession;
  snapshot?: VoiceSnapshot;
  onSpeaking?: (active: boolean) => void;
  onClient?: (client: VoiceController | null) => void;
  onState?: (state: VoiceState) => void;
  unavailableReason?: string;
}) {
  const client = useRef<VoiceController | null>(null),
    alive = useRef(true),
    joining = useRef(false),
    attempt = useRef(0),
    speechAttempt = useRef(0),
    microphoneBusy = useRef(false);
  const latest = useRef({ snapshot, onSpeaking, onClient, onState });
  useEffect(() => {
    latest.current = { snapshot, onSpeaking, onClient, onState };
  }, [snapshot, onSpeaking, onClient, onState]);
  const [state, setState] = useState(initial),
    [open, setOpen] = useState(false),
    [armed, setArmed] = useState(false),
    [deafened, setDeafened] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState(''),
    [nearby, setNearby] = useState(false);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]),
    [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [canSelectOutput, setCanSelectOutput] = useState(false);
  useEffect(() => {
    if (!state.connected) return;
    let live = true;
    const refresh = async () => {
      const c = client.current;
      const [inputs, speakers] = await Promise.all([
        c?.devices().catch(() => []) ?? [],
        c?.outputs?.().catch(() => []) ?? [],
      ]);
      if (live) {
        setDevices(inputs);
        setOutputs(speakers);
        setCanSelectOutput(!!c?.supportsOutputSelection);
      }
    };
    void refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    return () => {
      live = false;
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
    };
  }, [state.connected, state.mic]);
  const { mode, shortcut } = useSyncExternalStore(
    subscribeControls,
    voiceControls,
    serverControls,
  );
  useEffect(() => {
    latest.current.onState?.({ ...state, ready: armed, mode });
  }, [state, armed, mode]);
  const holds = useRef<ReturnType<typeof bindPushToTalk> | null>(null);
  function changeMode(next: 'open' | 'push') {
    holds.current?.reset();
    speechAttempt.current++;
    void client.current?.microphone(false);
    setArmed(false);
    saveControls(next, shortcut);
  }
  useEffect(() => {
    alive.current = true;
    const cancelJoin = () => {
      attempt.current++;
    };
    return () => {
      alive.current = false;
      cancelJoin();
      const c = client.current;
      client.current = null;
      latest.current.onClient?.(null);
      void c?.dispose();
      latest.current.onSpeaking(false);
    };
  }, [session?.game, session?.code, session?.id, session?.token]);
  useEffect(() => {
    client.current?.update({ ...snapshot, nearby });
  }, [snapshot, nearby]);
  useEffect(() => {
    latest.current.onSpeaking(
      state.connected &&
        !deafened &&
        state.speaking.some(
          (id) => id !== session?.id && (volumes[id] ?? 1) > 0,
        ),
    );
  }, [state.connected, state.speaking, deafened, session?.id, volumes]);
  useEffect(() => {
    if (!state.connected || !armed || mode !== 'push') return;
    const binding = bindPushToTalk(window, shortcut, (active) => {
      void client.current?.setTalking(active);
    });
    holds.current = binding;
    return () => {
      binding.dispose();
      holds.current = null;
    };
  }, [state.connected, armed, mode, shortcut]);
  useEffect(() => {
    const resetTalk = () => holds.current?.reset();
    const stop = () => {
      speechAttempt.current++;
      holds.current?.reset();
      if (
        mode === 'open' &&
        !(
          document.activeElement instanceof HTMLIFrameElement &&
          document.activeElement.classList.contains('party-game-frame') &&
          !document.hidden
        )
      ) {
        void client.current?.microphone(false);
        setArmed(false);
      }
    };
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('blur', stop);
    window.addEventListener('game:voice-reset-talk', resetTalk);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', stop);
      window.removeEventListener('game:voice-reset-talk', resetTalk);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [mode]);
  async function join(speak: boolean) {
    if (joining.current || !session) return;
    joining.current = true;
    const request = ++attempt.current;
    const speechRequest = ++speechAttempt.current;
    setBusy(true);
    setState({ ...initial, status: 'Connecting…' });
    try {
      const { VoiceClient } = await import('./peer-client');
      if (!alive.current || request !== attempt.current) return;
      await client.current?.dispose();
      if (!alive.current || request !== attempt.current) return;
      const c = new VoiceClient(session, (s) => {
        if (alive.current && client.current === c) {
          setState(s);
          if (!s.connected || s.error) setArmed(false);
        }
      });
      client.current = c;
      Object.assign(c, {
        hold: (source: string, active: boolean) => {
          if (active) holds.current?.press(source);
          else holds.current?.release(source);
        },
      });
      latest.current.onClient?.(c);
      c.update({ ...latest.current.snapshot, nearby });
      c.deafen(deafened);
      for (const [id, volume] of Object.entries(volumes)) c.volume(id, volume);
      await c.connect();
      if (!alive.current || client.current !== c || request !== attempt.current)
        return;
      if (
        speak &&
        c.state.connected &&
        speechRequest === speechAttempt.current &&
        !document.hidden
      ) {
        if (mode === 'open') {
          await c.microphone(true, device || undefined);
          if (alive.current && client.current === c) setArmed(c.state.mic);
        } else {
          const prepared = await c.prepareMicrophone(device || undefined);
          if (alive.current && client.current === c) setArmed(prepared);
        }
        const available = await c.devices().catch(() => []);
        if (alive.current && client.current === c) setDevices(available);
      }
    } catch {
      if (alive.current && request === attempt.current)
        setState({
          ...initial,
          error: 'Voice could not load. Try joining again.',
        });
    } finally {
      if (request === attempt.current) {
        joining.current = false;
        if (alive.current) setBusy(false);
      }
    }
  }
  async function microphone() {
    const c = client.current;
    if (!c || microphoneBusy.current) return;
    microphoneBusy.current = true;
    setBusy(true);
    try {
      if ((mode === 'push' && armed) || c.state.mic) {
        await c.microphone(false);
        if (alive.current && client.current === c) setArmed(c.state.mic);
      } else {
        const prepared =
          mode === 'push'
            ? await c.prepareMicrophone(device || undefined)
            : (await c.microphone(true, device || undefined), c.state.mic);
        if (!alive.current || client.current !== c) return;
        setArmed(prepared);
        const available = await c.devices().catch(() => []);
        if (alive.current && client.current === c) setDevices(available);
      }
    } finally {
      microphoneBusy.current = false;
      if (alive.current && client.current === c) setBusy(false);
    }
  }
  function leave() {
    holds.current?.reset();
    attempt.current++;
    speechAttempt.current++;
    joining.current = false;
    const c = client.current;
    client.current = null;
    latest.current.onClient?.(null);
    void c?.dispose();
    setState(initial);
    setArmed(false);
    setBusy(false);
    onSpeaking(false);
  }
  const microphoneEnabled = mode === 'push' ? armed : state.mic;
  const keyLabel = shortcut.slice(3);
  function holdButton(inPanel: boolean) {
    return (
      <button
        type="button"
        data-voice-hold="true"
        className={`${inPanel ? 'voice-hold-inline' : 'voice-hold'} ${state.mic ? 'voice-live' : ''}`}
        onPointerDown={(e) => {
          if (e.button !== 0 || !e.isPrimary) return;
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          holds.current?.press(`pointer:${e.pointerId}`);
        }}
        onPointerUp={(e) => holds.current?.release(`pointer:${e.pointerId}`)}
        onPointerCancel={(e) =>
          holds.current?.release(`pointer:${e.pointerId}`)
        }
        onLostPointerCapture={(e) =>
          holds.current?.release(`pointer:${e.pointerId}`)
        }
        onContextMenu={(e) => e.preventDefault()}
        aria-label={`Hold ${keyLabel} or this button to talk`}
        aria-pressed={state.mic}
        aria-keyshortcuts={keyLabel}
      >
        <Mic size={18} aria-hidden="true" />
        <span>{state.mic ? 'Talking' : 'Hold to talk'}</span>
        <kbd>{keyLabel}</kbd>
      </button>
    );
  }
  if (
    typeof window !== 'undefined' &&
    window.parent !== window &&
    new URLSearchParams(location.search).has('party')
  )
    return null;
  return (
    <>
      {state.connected &&
        armed &&
        mode === 'push' &&
        !open &&
        holdButton(false)}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          holds.current?.reset();
          setOpen(next);
        }}
      >
        <DialogTrigger
          className="game-toolbar-button voice-trigger"
          aria-label={
            state.mic
              ? 'Voice chat — microphone live'
              : state.connected
                ? 'Voice chat — connected'
                : 'Voice chat'
          }
          title={state.mic ? 'Microphone live · voice settings' : 'Voice chat'}
          data-connected={state.connected}
          data-live={state.mic}
        >
          {state.mic ? (
            <Mic size={18} />
          ) : state.connected ? (
            <Headphones size={18} />
          ) : (
            <Radio size={18} />
          )}
          <span>Voice</span>
          {state.connected && (
            <i className="voice-trigger-dot" aria-hidden="true" />
          )}
        </DialogTrigger>
        <DialogContent className="voice-panel">
          <DialogTitle>Room voice</DialogTitle>
          <DialogDescription>
            {session
              ? 'Choose how you want to talk, or join just to listen.'
              : unavailableReason}
          </DialogDescription>
          {session && (
            <>
              <fieldset className="voice-modes" disabled={busy}>
                <legend>Microphone mode</legend>
                <label
                  aria-label="Push to talk"
                  data-selected={mode === 'push'}
                >
                  <input
                    type="radio"
                    name="voice-mode"
                    checked={mode === 'push'}
                    onChange={() => changeMode('push')}
                  />
                  <span>
                    <strong>Push to talk</strong>
                    <small>Only while you hold a key or button</small>
                  </span>
                </label>
                <label aria-label="Open mic" data-selected={mode === 'open'}>
                  <input
                    type="radio"
                    name="voice-mode"
                    checked={mode === 'open'}
                    onChange={() => changeMode('open')}
                  />
                  <span>
                    <strong>Open mic</strong>
                    <small>Talk freely until you mute</small>
                  </span>
                </label>
              </fieldset>
              {mode === 'push' && (
                <label className="voice-shortcut">
                  Talk key
                  <select
                    aria-label="Talk key"
                    value={shortcut}
                    disabled={busy}
                    onChange={(e) => {
                      holds.current?.reset();
                      saveControls(mode, e.target.value);
                    }}
                  >
                    {['T', 'V', 'B'].map((key) => (
                      <option key={key} value={`Key${key}`}>
                        {key}
                      </option>
                    ))}
                  </select>
                  <small>
                    While voice is ready, this key is reserved for talking. It
                    won’t activate while typing.
                  </small>
                </label>
              )}
              <output aria-live="polite">
                {state.status}
                {state.connected
                  ? state.mic
                    ? ' · Talking'
                    : microphoneEnabled
                      ? ` · Ready · Hold ${keyLabel} to talk`
                      : ' · Microphone off'
                  : ''}
              </output>
              {state.error && <p role="alert">{state.error}</p>}
              {state.audioBlocked && (
                <button onClick={() => void client.current?.resumeAudio()}>
                  <Headphones size={17} /> Enable voice playback
                </button>
              )}
              {!state.connected ? (
                <div className="voice-actions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void join(true)}
                  >
                    {busy ? (
                      <LoaderCircle size={17} className="voice-spin" />
                    ) : (
                      <Mic size={17} />
                    )}
                    {busy
                      ? 'Joining…'
                      : mode === 'push'
                        ? 'Join with push to talk'
                        : 'Join with open mic'}
                  </button>
                  <button disabled={busy} onClick={() => void join(false)}>
                    <Headphones size={17} /> Listen only
                  </button>
                  {busy && <button onClick={leave}>Cancel</button>}
                </div>
              ) : (
                <>
                  <div className="voice-actions">
                    <button disabled={busy} onClick={() => void microphone()}>
                      {microphoneEnabled ? (
                        <MicOff size={17} />
                      ) : (
                        <Mic size={17} />
                      )}
                      {busy
                        ? 'Setting up microphone…'
                        : microphoneEnabled
                          ? mode === 'push'
                            ? 'Disable push to talk'
                            : 'Mute microphone'
                          : mode === 'push'
                            ? 'Enable push to talk'
                            : 'Enable microphone'}
                    </button>
                    <button onClick={leave}>Leave voice</button>
                  </div>
                  {mode === 'push' && armed && (
                    <>
                      {holdButton(true)}
                      <p className="voice-note">
                        Your microphone is ready but silent until you hold.
                        Release to stop talking.
                      </p>
                    </>
                  )}
                  {devices.length > 0 && (
                    <label>
                      Microphone
                      <select
                        disabled={busy}
                        value={device}
                        onChange={(e) => {
                          setDevice(e.target.value);
                          setArmed(false);
                          void client.current?.microphone(false);
                        }}
                      >
                        <option value="">System default</option>
                        {devices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label || 'Microphone'}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {canSelectOutput && (
                    <label>
                      Speakers
                      <select
                        value={output}
                        onChange={(e) => {
                          const id = e.target.value;
                          void client.current
                            ?.outputDevice?.(id)
                            .then(() => setOutput(id))
                            .catch(() =>
                              setState((s) => ({
                                ...s,
                                error:
                                  'Could not select that speaker. Use the system default.',
                              })),
                            );
                        }}
                      >
                        <option value="">System default</option>
                        {outputs
                          .filter((d) => d.deviceId !== 'default')
                          .map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                              {d.label || 'Speaker'}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <MicrophoneCheck />
                  {state.connectionInfo && (
                    <p className="voice-note">{state.connectionInfo}</p>
                  )}
                  <label>
                    Microphone level
                    <progress value={state.level} max={1} />
                  </label>
                  <label className="voice-check">
                    <input
                      type="checkbox"
                      checked={deafened}
                      onChange={(e) => {
                        setDeafened(e.target.checked);
                        client.current?.deafen(e.target.checked);
                        if (e.target.checked) onSpeaking(false);
                      }}
                    />
                    Mute incoming voices
                  </label>
                  {session.game === 'stack-or-sink' && (
                    <label className="voice-check">
                      <input
                        type="checkbox"
                        checked={nearby}
                        onChange={(e) => setNearby(e.target.checked)}
                      />
                      Make distant voices quieter
                    </label>
                  )}
                  {session.game === 'act-natural' && (
                    <p className="voice-note">
                      Everyone hears room voice equally. Speaking never
                      identifies your cow.
                    </p>
                  )}
                  <div className="voice-peers">
                    {snapshot.players
                      .filter((p) => p.id !== session.id)
                      .map((p) => (
                        <label key={p.id}>
                          <span>
                            {p.name}
                            {state.speaking.includes(p.id) ? ' · speaking' : ''}
                          </span>
                          <input
                            aria-label={`${p.name} voice volume`}
                            type="range"
                            min="0"
                            max="1"
                            step=".05"
                            value={volumes[p.id] ?? 1}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setVolumes((old) => ({ ...old, [p.id]: v }));
                              client.current?.volume(p.id, v);
                            }}
                          />
                        </label>
                      ))}
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
