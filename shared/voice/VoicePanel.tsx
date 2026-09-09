'use client';
import { useEffect, useRef, useState } from 'react';
import { Headphones, LoaderCircle, Mic, MicOff, Radio } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { VoiceClient, VoiceState } from './client';
import type { VoiceSession, VoiceSnapshot } from './types';
import './voice.css';
const initial: VoiceState = {
  status: 'Voice off',
  connected: false,
  mic: false,
  speaking: [],
  level: 0,
};
const emptySnapshot: VoiceSnapshot = { players: [], nearby: false };
const ignoreSpeaking = (_active: boolean) => {};
type VoiceController = Pick<
  VoiceClient,
  | 'state'
  | 'connect'
  | 'dispose'
  | 'microphone'
  | 'prepareMicrophone'
  | 'devices'
  | 'resumeAudio'
  | 'update'
  | 'volume'
  | 'deafen'
>;
export default function VoicePanel({
  session,
  snapshot = emptySnapshot,
  onSpeaking = ignoreSpeaking,
  unavailableReason = 'Create or join a multiplayer room to talk with friends.',
}: {
  session?: VoiceSession;
  snapshot?: VoiceSnapshot;
  onSpeaking?: (active: boolean) => void;
  unavailableReason?: string;
}) {
  const client = useRef<VoiceController | null>(null),
    alive = useRef(true),
    joining = useRef(false),
    attempt = useRef(0),
    speechAttempt = useRef(0),
    microphoneBusy = useRef(false);
  const latest = useRef({ snapshot, onSpeaking });
  useEffect(() => {
    latest.current = { snapshot, onSpeaking };
  }, [snapshot, onSpeaking]);
  const [state, setState] = useState(initial),
    [open, setOpen] = useState(false),
    [armed, setArmed] = useState(false),
    [mode, setMode] = useState<'open' | 'push'>('open'),
    [deafened, setDeafened] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState(''),
    [nearby, setNearby] = useState(false);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
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
    const stop = () => {
      speechAttempt.current++;
      void client.current?.microphone(false);
      if (mode === 'open') setArmed(false);
    };
    const down = (e: KeyboardEvent) => {
      if (
        e.code !== 'KeyT' ||
        e.repeat ||
        !armed ||
        mode !== 'push' ||
        (e.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable]',
        )
      )
        return;
      e.preventDefault();
      void client.current?.microphone(true, device || undefined);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'KeyT' && mode === 'push') stop();
    };
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [armed, mode, device]);
  async function join(speak: boolean) {
    if (joining.current || !session) return;
    joining.current = true;
    const request = ++attempt.current;
    const speechRequest = ++speechAttempt.current;
    setBusy(true);
    setState({ ...initial, status: 'Connecting…' });
    try {
      const { VoiceClient } = session.peer
        ? await import('./peer-client')
        : await import('./client');
      if (!alive.current || request !== attempt.current) return;
      await client.current?.dispose();
      if (!alive.current || request !== attempt.current) return;
      const c = new VoiceClient(session, (s) => {
        if (alive.current && client.current === c) {
          setState(s);
          if (!s.connected) setArmed(false);
        }
      });
      client.current = c;
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
    attempt.current++;
    speechAttempt.current++;
    joining.current = false;
    const c = client.current;
    client.current = null;
    void c?.dispose();
    setState(initial);
    setArmed(false);
    setBusy(false);
    onSpeaking(false);
  }
  const microphoneEnabled = mode === 'push' ? armed : state.mic;
  return (
    <>
      {state.connected && armed && mode === 'push' && (
        <button
          className={`voice-hold ${state.mic ? 'voice-live' : ''}`}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            void client.current?.microphone(true, device || undefined);
          }}
          onPointerUp={() => void client.current?.microphone(false)}
          onPointerCancel={() => void client.current?.microphone(false)}
          onLostPointerCapture={() => void client.current?.microphone(false)}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Hold to talk"
        >
          <Mic size={16} /> Hold to talk · T
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
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
              ? 'Talk with everyone in this game room. Join voice turns on your microphone after you allow access. You can mute or leave at any time.'
              : unavailableReason}
          </DialogDescription>
          {session && (
            <>
              <output aria-live="polite">
                {state.status}
                {state.connected
                  ? state.mic
                    ? ' · Microphone live'
                    : microphoneEnabled
                      ? ' · Hold to talk'
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
                    {busy ? 'Joining…' : 'Join voice'}
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
                          ? 'Mute microphone'
                          : 'Enable microphone'}
                    </button>
                    <button onClick={leave}>Leave voice</button>
                  </div>
                  <label>
                    Speaking mode
                    <select
                      disabled={busy}
                      value={mode}
                      onChange={(e) => {
                        setMode(e.target.value as 'open' | 'push');
                        void client.current?.microphone(false);
                        setArmed(false);
                      }}
                    >
                      <option value="open">
                        Open microphone · talk naturally
                      </option>
                      <option value="push">
                        Push to talk · hold T or the talk button
                      </option>
                    </select>
                  </label>
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
