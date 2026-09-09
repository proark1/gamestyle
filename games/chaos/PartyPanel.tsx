'use client';
import { DisasterChallenge } from './DisasterChallenge';
// Local blob previews cannot use the image optimizer; game clips have no generated caption track.
/* oxlint-disable nextjs/no-img-element, jsx-a11y/media-has-caption */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { Snapshot } from './model';
import type { MobilePanel } from './Game';
import { ChevronDown, X, Mic, MicOff, Radio } from 'lucide-react';
import { HeldInputs } from './touch';
import { HoldControl } from './HoldControl';
import { TouchActionButton } from './TouchActionButton';
import type { Connection, Session } from './connection';
import type { GameScene } from './scene';
import type { GameAudio } from './sound';
import type { VoiceClient, VoiceState } from './voice/client';
import {
  CREW_JOBS,
  challengeLink,
  roleAnchor,
  type PartyAction,
} from './party';
import { downloadBlob, MomentRecorder, postcard } from './capture';
import './party.css';
import './saved-build.css';
import { CrewScrapbook } from './CrewScrapbook';
import { BuildShelf } from './BuildShelf';
import { SwapPanel } from './SwapPanel';
import { InspectionPanel } from './InspectionPanel';
type CrewControls = { x: number; z: number; turn: number; work: boolean };
type Props = {
  snapshot: Snapshot;
  broadcast?: boolean;
  compact: boolean;
  mobilePanel: MobilePanel;
  onMobilePanel: (panel: MobilePanel) => void;
  session: Session;
  connection: Connection;
  scene: GameScene;
  audio: GameAudio | null;
  notify: (message: string) => void;
  invite: () => void;
  checklist: () => void;
  inputBlocked?: boolean;
  voiceRequest?: number;
};
export function PartyPanel({
  snapshot: s,
  broadcast = false,
  compact,
  mobilePanel,
  onMobilePanel,
  session,
  connection,
  scene,
  audio,
  notify,
  invite,
  checklist,
  inputBlocked = false,
  voiceRequest = 0,
}: Props) {
  const voiceDetails = useRef<HTMLDetailsElement>(null);
  const p = s.world.party!;
  const host = s.host === session.id,
    role = p.task.roles.indexOf(session.id),
    active = ['building', 'lastCall', 'rescue'].includes(p.phase);
  const live = useRef({ s, connection, scene, notify });
  useLayoutEffect(() => {
    live.current = { s, connection, scene, notify };
  }, [s, connection, scene, notify]);
  const [voice, setVoice] = useState<VoiceState>({
    status: 'Voice off',
    connected: false,
    mic: false,
    speaking: [],
    level: 0,
  });
  const voiceRef = useRef<VoiceClient | null>(null),
    connecting = useRef(false);
  const [armed, setArmed] = useState(false),
    [ptt, setPtt] = useState(false),
    [pttKey, setPttKey] = useState('KeyT'),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [duck, setDuck] = useState(true),
    [cardOpen, setCardOpen] = useState(false),
    [showNames, setShowNames] = useState(false),
    [portrait, setPortrait] = useState(false);
  const [recording, setRecording] = useState(false),
    [recordText, setRecordText] = useState('Recording off'),
    [includeVoice, setIncludeVoice] = useState(false);
  const [preview, setPreview] = useState<{
    blob: Blob;
    type: 'video' | 'image';
    url: string;
  } | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false),
    [mediaBusy, setMediaBusy] = useState(false);
  useEffect(() => {
    if (voiceRequest && voiceDetails.current) {
      setMediaOpen(false);
      voiceDetails.current.open = true;
      voiceDetails.current.querySelector('summary')?.focus();
    }
  }, [voiceRequest]);
  const [crewOpen, setCrewOpen] = useState(true);
  const [shortRecording, setShortRecording] = useState(false);
  const [savedBuildId, setSavedBuildId] = useState('');
  const [highlights, setHighlights] = useState<MomentRecorder['highlights']>(
    [],
  );
  const [canSave, setCanSave] = useState(false);
  const [followInspector, setFollowInspector] = useState(true);

  const recorder = useRef<MomentRecorder | null>(null),
    controls = useRef<CrewControls>({ x: 0, z: 0, turn: 0, work: false });
  const heldInputs = useRef(new HeldInputs());
  const radioOn = useRef(false),
    radioTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const mounted = useRef(true);
  const pendingCommands = useRef(new Set<string>());
  const act = useCallback(async (action: PartyAction) => {
    const discrete = [
      'role',
      'release',
      'place',
      'repair',
      'recover',
      'collect',
      'steady',
      'start',
      'skip',
    ].includes(action.op);
    if (discrete && pendingCommands.current.has(action.op)) return;
    if (discrete) pendingCommands.current.add(action.op);
    const local = live.current.scene.local;
    if (local)
      live.current.connection.position = {
        x: local.x,
        y: local.y,
        z: local.z,
        angle: local.angle,
        jump: local.jump || 0,
      };
    try {
      await live.current.connection.action(action);
    } catch (error) {
      live.current.notify((error as Error).message);
    } finally {
      if (discrete) pendingCommands.current.delete(action.op);
    }
  }, []);
  useEffect(() => {
    voiceRef.current?.update(s);
  }, [s]);

  useEffect(() => {
    audio?.duck(duck && voice.speaking.length > 0);
    return () => audio?.duck(false);
  }, [audio, duck, voice.speaking.length]);
  useEffect(() => {
    scene.setSpeaking(voice.speaking);
  }, [scene, voice.speaking]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  const consent = p.audioConsent.join('|');
  const previousConsent = useRef(consent);
  useEffect(() => {
    if (
      previousConsent.current
        .split('|')
        .some((id) => id && !p.audioConsent.includes(id))
    ) {
      recorder.current?.invalidate();
      setPreview(null);
    }
    previousConsent.current = consent;
  }, [consent, p.audioConsent]);
  useEffect(() => {
    mounted.current = true;
    const clear = () => {
      controls.current = heldInputs.current.clear();
      radioOn.current = false;
      if (radioTimer.current) clearInterval(radioTimer.current);
    };
    const hidePage = () => {
      clear();
      void voiceRef.current?.microphone(false);
      void recorder.current?.stop();
    };
    const visibility = () => {
      if (document.hidden) hidePage();
    };
    window.addEventListener('blur', clear);
    window.addEventListener('pagehide', hidePage);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mounted.current = false;
      clear();
      window.removeEventListener('blur', clear);
      window.removeEventListener('pagehide', hidePage);
      document.removeEventListener('visibilitychange', visibility);
      void voiceRef.current?.dispose();
      void recorder.current?.stop();
      scene.speaking.clear();
    };
  }, [session.id, scene]);

  useEffect(() => {
    if (!armed || !ptt) return;
    const down = (e: KeyboardEvent) => {
      if (
        e.code !== pttKey ||
        e.repeat ||
        (e.target as HTMLElement)?.closest(
          'input,textarea,[contenteditable=true]',
        )
      )
        return;
      e.preventDefault();
      void voiceRef.current?.microphone(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === pttKey) void voiceRef.current?.microphone(false);
    };
    const release = () => {
      void voiceRef.current?.microphone(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      release();
    };
  }, [armed, ptt, pttKey]);
  useEffect(() => {
    if (role < 0 || !active || inputBlocked || p.task.phase !== 'working')
      return;
    const inputs = heldInputs.current;
    let alive = true,
      busy = false,
      wasMoving = false;
    const send = async () => {
      if (busy || !alive || scene.paused) return;
      const task = live.current.s.world.party!.task;
      if (!task.roles.includes(session.id)) return;
      if (task.kind === 'ladder' && !task.solo && task.roles[0] === session.id)
        return;
      const keys = scene.crewInput,
        pointer = controls.current;
      const input = {
        x: keys.x || pointer.x,
        z: keys.z || pointer.z,
        turn: keys.turn || pointer.turn,
      };
      const moving = !!(input.x || input.z || input.turn || pointer.work);
      if (!moving && !wasMoving) return;
      wasMoving = moving;
      busy = true;
      try {
        await live.current.connection.action(
          task.kind === 'ladder' && moving
            ? { type: 'party', op: 'work' }
            : { type: 'party', op: 'drive', ...input },
        );
      } catch (error) {
        if (alive) live.current.notify((error as Error).message);
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(() => void send(), 150);
    return () => {
      alive = false;
      clearInterval(timer);
      controls.current = inputs.clear();
      if (
        wasMoving &&
        live.current.s.world.party?.task.roles.includes(session.id)
      )
        void live.current.connection
          .action({ type: 'party', op: 'drive', x: 0, z: 0, turn: 0 })
          .catch(() => {});
    };
  }, [role, active, scene, session.id, inputBlocked, p.task.phase]);
  async function joinVoice() {
    if (connecting.current) return;
    connecting.current = true;
    try {
      if (!voiceRef.current) {
        const { VoiceClient } = await import('./voice/client');
        if (!mounted.current) return;
        voiceRef.current = new VoiceClient(session, (value) => {
          if (mounted.current) {
            setVoice(value);
            if (!value.connected) setArmed(false);
          }
        });
      }
      await voiceRef.current.connect();
      voiceRef.current.update(live.current.s);
    } catch {
      notify('Voice could not connect. Please try again.');
    } finally {
      connecting.current = false;
    }
  }
  async function microphone() {
    const client = voiceRef.current;
    if (!client) return;
    if (armed) {
      setArmed(false);
      await client.microphone(false);
      return;
    }
    await client.microphone(true);
    if (!client.state.mic) return;
    setDevices(await client.devices());
    setArmed(true);
    if (ptt) await client.microphone(false);
  }
  const radio = useCallback(
    (enabled: boolean) => {
      if (enabled && !radioOn.current) audio?.play('voice.radio');
      radioOn.current = enabled;
      if (radioTimer.current) clearInterval(radioTimer.current);
      if (enabled && armed) {
        void voiceRef.current?.microphone(true);
        void act({ type: 'party', op: 'radio', enabled: true });
        radioTimer.current = setInterval(
          () => void act({ type: 'party', op: 'radio', enabled: true }),
          700,
        );
      } else {
        void act({ type: 'party', op: 'radio', enabled: false });
        if (ptt) void voiceRef.current?.microphone(false);
      }
    },
    [armed, ptt, act, audio],
  );
  async function startRecording() {
    if (s.recordingEnabled === false) {
      notify('Clips are unavailable on this site. Save a postcard instead.');
      return;
    }
    if (mediaBusy) return;
    setMediaBusy(true);
    try {
      const rec = new MomentRecorder(
        scene,
        (text) => {
          if (mounted.current) {
            setRecordText(text);
            setCanSave(!!recorder.current?.hasMoment);
            setHighlights([...(recorder.current?.highlights || [])]);
          }
        },
        () => {
          setPreview(null);
          setHighlights([]);
        },
        () => {
          voiceRef.current?.capture(false);
          if (mounted.current) {
            setRecording(false);
            void act({ type: 'party', op: 'recording', enabled: false });
          }
        },
        showNames,
        shortRecording,
        portrait,
        savedBuildId
          ? `${location.host}/build/${savedBuildId}`
          : location.host + '/chaos',
      );
      recorder.current = rec;
      // Unlock audio on the initiating gesture; encoding starts after the room announcement.
      const streams = [audio?.captureStream(), voiceRef.current?.captureStream];
      await rec.prepareAudio();
      await live.current.connection.action({
        type: 'party',
        op: 'recording',
        enabled: true,
      });
      if (!mounted.current || document.hidden)
        throw new Error(
          'Recording stopped because the game is no longer visible.',
        );
      voiceRef.current?.capture(includeVoice);
      await rec.start(streams);
      audio?.play('capture.start');
      setRecording(true);
    } catch (error) {
      notify((error as Error).message);
      await recorder.current?.stop();
    } finally {
      setMediaBusy(false);
    }
  }
  const stopRecording = useCallback(async () => {
    await recorder.current?.stop();
    setRecording(false);
    voiceRef.current?.capture(false);
    await act({ type: 'party', op: 'recording', enabled: false });
  }, [act]);
  useEffect(() => {
    if (s.recordingEnabled === false && recording)
      queueMicrotask(() => void stopRecording());
  }, [s.recordingEnabled, recording, stopRecording]);
  const previousRound = useRef(p.roundId);
  useEffect(() => {
    if (previousRound.current === p.roundId) return;
    previousRound.current = p.roundId;
    setSavedBuildId('');
    setPreview(null);
    setCardOpen(false);
    void stopRecording();
  }, [p.roundId, stopRecording]);
  const previousVoiceConnection = useRef(false);
  useEffect(() => {
    const disconnected = previousVoiceConnection.current && !voice.connected;
    if (voice.connected && !previousVoiceConnection.current)
      audio?.play('voice.join');
    if (disconnected) audio?.play('voice.leave');
    previousVoiceConnection.current = voice.connected;
    if (disconnected && recording && includeVoice)
      queueMicrotask(() => void stopRecording());
  }, [voice.connected, recording, includeVoice, stopRecording, audio]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        controls.current = { x: 0, z: 0, turn: 0, work: false };
        void voiceRef.current?.microphone(false);
        setArmed(false);
        radio(false);
        void stopRecording();
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [radio, stopRecording]);
  async function saveMoment() {
    setMediaBusy(true);
    try {
      const blob = await recorder.current?.save();
      if (!mounted.current) return;
      if (blob?.size) {
        audio?.play('capture.saved');
        setPreview({ blob, url: URL.createObjectURL(blob), type: 'video' });
        setMediaOpen(true);
      } else notify('No moment is ready yet. Start recording first.');
    } finally {
      setMediaBusy(false);
    }
  }
  async function picture() {
    setMediaBusy(true);
    try {
      const blob = await postcard(
        scene,
        s.world,
        portrait,
        showNames,
        savedBuildId
          ? `${location.host}/build/${savedBuildId}`
          : location.host + '/chaos',
      );
      if (!mounted.current) return;
      audio?.play('event.photo');
      setPreview({ blob, url: URL.createObjectURL(blob), type: 'image' });
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setMediaBusy(false);
    }
  }
  async function shareChallenge() {
    try {
      await navigator.clipboard.writeText(
        challengeLink(location.origin, s.world),
      );
      notify('Challenge link copied. It starts a fresh site for a new crew.');
    } catch {
      notify(challengeLink(location.origin, s.world));
    }
  }
  async function shareFile() {
    if (!preview) return;
    const extension =
      preview.type === 'image'
        ? 'png'
        : preview.blob.type.includes('mp4')
          ? 'mp4'
          : 'webm';
    const file = new File([preview.blob], `permit-pending.${extension}`, {
      type: preview.blob.type,
    });
    if (!navigator.canShare?.({ files: [file] })) {
      downloadBlob(preview.blob, file.name);
      return;
    }
    try {
      await navigator.share({
        files: [file],
        title: 'PERMIT PENDING',
        text: savedBuildId
          ? `${location.origin}/build/${savedBuildId}`
          : challengeLink(location.origin, s.world),
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError')
        notify('Sharing did not complete. You can download the file instead.');
    }
  }
  function openMedia() {
    setMediaOpen(true);
    if (compact) onMobilePanel('social');
  }
  function take(slot: number) {
    setCrewOpen(true);
    if (compact) {
      onMobilePanel(null);
      scene.setPaused(false);
    }
    const target = roleAnchor(p.task, slot);
    scene.goTo(
      target,
      () => void act({ type: 'party', op: 'role', role: slot }),
      'To crew handle',
    );
  }
  const controlInput = useCallback(
    (patch: Partial<CrewControls>, source: string) => {
      controls.current = heldInputs.current.set(source, patch);
    },
    [],
  );
  useEffect(() => {
    if (compact && mobilePanel !== 'crew')
      controls.current = heldInputs.current.clear();
  }, [compact, mobilePanel]);
  const job = CREW_JOBS.find((j) => j.id === p.job)!;
  function walkAndAct(
    target: { x: number; z: number },
    action: PartyAction,
    label: string,
  ) {
    if (role >= 0) {
      notify('Release your delivery role before walking over.');
      return;
    }
    if (compact) onMobilePanel(null);
    scene.setPaused(false);
    scene.goTo(target, () => void act(action), label);
  }
  const leak =
    p.inspection &&
    s.now >= p.inspection.rainAt &&
    s.now <= p.inspection.rainUntil &&
    !p.inspection.leakFixed;
  const canDeliver =
    p.task.phase === 'working' &&
    p.task.kind !== 'ladder' &&
    Math.hypot(p.task.x - p.task.target.x, p.task.z - p.task.target.z) <=
      1.25 &&
    (p.task.kind !== 'crane' || role === 1 || p.task.solo) &&
    !p.task.dropVotes.includes(session.id);
  return (
    <div
      className="party-layer"
      data-view={
        !active
          ? 'finale'
          : compact
            ? mobilePanel === 'crew'
              ? 'crew'
              : 'building'
            : crewOpen
              ? 'crew'
              : 'building'
      }
      data-mobile-panel={mobilePanel || 'none'}
    >
      {compact && active && (
        <button
          className="mobile-job-summary"
          aria-expanded={mobilePanel === 'crew'}
          aria-controls="crew-delivery-details"
          onClick={() => onMobilePanel(mobilePanel === 'crew' ? null : 'crew')}
        >
          <span>
            {p.phase === 'rescue'
              ? 'Repair time'
              : p.phase === 'lastCall'
                ? 'Customer arriving'
                : p.swap
                  ? 'Build & Swap'
                  : p.format === 'inspection'
                    ? 'Will It Hold?'
                    : job.name}
            <small>
              {p.task.phase === 'done'
                ? 'Delivery done · finish building'
                : role >= 0
                  ? 'Carrying · joystick to move'
                  : 'Tap for your job & checklist'}
            </small>
          </span>
          <strong>
            {s.world.mode === 'sandbox'
              ? 'Free play'
              : `${Math.floor(Math.max(0, p.deadline - s.now) / 60000)}:${String(Math.floor(Math.max(0, p.deadline - s.now) / 1000) % 60).padStart(2, '0')}`}
          </strong>
          <ChevronDown size={16} />
        </button>
      )}
      {active && !compact && (
        <nav className="party-tabs" aria-label="Job panels">
          <button aria-pressed={crewOpen} onClick={() => setCrewOpen(true)}>
            Crew delivery
          </button>
          <button
            aria-pressed={!crewOpen}
            onClick={() => {
              setCrewOpen(false);
              checklist();
            }}
          >
            Building checklist
          </button>
        </nav>
      )}
      {p.phase === 'lobby' && (
        <section className="party-lobby" aria-label="Crew lobby">
          <span className="party-eyebrow">THE SITE CABIN</span>
          <h1>Get the crew together.</h1>
          <DisasterChallenge
            key={p.roundId}
            snapshot={s}
            session={session}
            notify={notify}
            onSaved={setSavedBuildId}
          />
          <p>
            The clock starts when your site manager says so. Voice stays with
            you throughout the shift.
          </p>
          <div className="party-roster">
            {s.players.map((v) => (
              <div key={v.id}>
                <span>{v.name}</span>
                <b>{p.ready.includes(v.id) ? 'Ready' : 'Getting settled'}</b>
              </div>
            ))}
          </div>
          <label>
            Crew name
            <input
              className="crew-name-input"
              maxLength={32}
              defaultValue={p.crewName || ''}
              disabled={!host}
              onBlur={(e) => {
                if (host && e.target.value !== (p.crewName || ''))
                  void act({
                    type: 'party',
                    op: 'configure',
                    crewName: e.target.value,
                  });
              }}
              placeholder="The Crooked Corners"
            />
          </label>
          <label>
            Round format
            <select
              value={p.format || 'classic'}
              disabled={!host || !!p.challenge}
              onChange={(e) =>
                void act({
                  type: 'party',
                  op: 'configure',
                  format: e.target.value as 'classic' | 'inspection' | 'swap',
                })
              }
            >
              <option value="classic">Classic chaos</option>
              <option value="inspection">
                Will It Hold? · build, test, rescue
              </option>
              <option value="swap">
                Build & Swap · two pairs, two puzzles
              </option>
            </select>
          </label>
          <button
            disabled={!host || !!p.challenge}
            onClick={() =>
              void act({
                type: 'party',
                op: 'configure',
                daily: new Date(s.now).toISOString().slice(0, 10),
              })
            }
          >
            Play today’s shared challenge
          </button>
          {p.daily && (
            <p>
              {p.daily.date} · {p.daily.title} · same job for every crew
            </p>
          )}
          {p.format === 'swap' && (
            <p>
              Four builders. 90 seconds to build two delivery puzzles. Each pair
              proves its own route, then races through the other pair’s build.
            </p>
          )}
          {p.format === 'inspection' && (
            <p>
              Four minutes to deliver a sofa inside your house and keep the
              customer dry. A failed inspection gives you 20 seconds to fix it.
            </p>
          )}
          <label>
            Today’s special delivery
            <select
              value={p.job}
              disabled={
                !host ||
                !!p.challenge ||
                p.format === 'inspection' ||
                p.format === 'swap'
              }
              onChange={(e) =>
                void act({
                  type: 'party',
                  op: 'configure',
                  job: e.target.value as typeof p.job,
                })
              }
            >
              {CREW_JOBS.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </label>
          <p>{job.brief}</p>
          <label>
            Voice on site
            <select
              value={p.voiceMode}
              disabled={!host}
              onChange={(e) =>
                void act({
                  type: 'party',
                  op: 'configure',
                  voiceMode: e.target.value as 'global' | 'proximity',
                })
              }
            >
              <option value="global">Everyone hears everyone</option>
              <option value="proximity">Nearby voices + site radio</option>
            </select>
          </label>
          <div className="party-buttons">
            <button onClick={invite}>Invite friends</button>
            <button
              onClick={() =>
                void act({
                  type: 'party',
                  op: 'ready',
                  enabled: !p.ready.includes(session.id),
                })
              }
            >
              {p.ready.includes(session.id) ? 'Not ready yet' : 'I’m ready'}
            </button>
          </div>
          {host ? (
            <button
              className="party-primary"
              disabled={
                !!p.challenge && s.players.length !== p.challenge.crewSize
              }
              onClick={() => void act({ type: 'party', op: 'start' })}
            >
              {p.challenge ? 'Start challenge attempt' : 'Start the shift'}
              {s.players.length - p.ready.length
                ? ` · ${s.players.length - p.ready.length} not ready`
                : ''}
            </button>
          ) : (
            <p className="party-muted">
              Waiting for the site manager to start.
            </p>
          )}
          {s.players.length === 1 && (
            <small>
              A solo helper is included. Friends can still join during the job.
            </small>
          )}
        </section>
      )}
      {active && (compact ? mobilePanel === 'crew' : crewOpen) && (
        <section
          id="crew-delivery-details"
          className="party-job"
          aria-label="Crew delivery"
        >
          {compact && (
            <div className="mobile-sheet-heading">
              <h2>Your job</h2>
              <button
                aria-label="Close job details"
                onClick={() => onMobilePanel(null)}
              >
                <X size={20} />
              </button>
            </div>
          )}
          {compact && (
            <button className="mobile-checklist-link" onClick={checklist}>
              Building checklist →
            </button>
          )}
          <DisasterChallenge
            key={p.roundId}
            snapshot={s}
            session={session}
            notify={notify}
            onSaved={setSavedBuildId}
          />
          <SwapPanel
            snapshot={s}
            playerId={session.id}
            act={(a) => void act(a)}
          />
          <InspectionPanel
            snapshot={s}
            host={host}
            act={(a) => void act(a)}
            move={(x, z, run) => {
              if (role >= 0) {
                notify('Release your delivery role before walking over.');
                return;
              }
              if (compact) onMobilePanel(null);
              scene.setPaused(false);
              scene.goTo({ x, z }, run, 'To leaking pipe');
            }}
          />
          <span className="party-eyebrow">
            SPECIAL DELIVERY {p.task.phase === 'done' ? '✓' : ''}
          </span>
          <h2>{job.name}</h2>
          <p>
            {p.task.phase === 'done'
              ? 'Delivered. Now finish the building!'
              : job.brief}
          </p>
          {p.task.phase !== 'done' &&
            (!p.swap || p.swap.stage !== 'design') && (
              <>
                {role < 0 ? (
                  <div className="party-buttons">
                    {p.task.roles.map((id, i) => (
                      <button
                        key={i}
                        disabled={!!id || (s.players.length < 2 && i === 1)}
                        onClick={() => take(i)}
                      >
                        {id
                          ? s.players.find((v) => v.id === id)?.name ||
                            'Partner'
                          : p.task.kind === 'crane'
                            ? i
                              ? 'Be the spotter'
                              : 'Operate crane'
                            : p.task.kind === 'ladder'
                              ? i
                                ? 'Climb ladder'
                                : 'Hold ladder'
                              : `Take handle ${i + 1}`}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="party-muted">
                      {p.task.phase === 'waiting'
                        ? 'Waiting for your partner…'
                        : p.task.solo
                          ? 'Solo helper attached.'
                          : 'Coordinate your movement. Both directions matter.'}
                    </p>
                    {p.task.kind === 'ladder' ? (
                      role === 0 && !p.task.solo ? (
                        <output>
                          You’re holding the foot. Stay here while your partner
                          climbs.
                        </output>
                      ) : (
                        <HoldButton
                          input={{ work: true }}
                          onMove={controlInput}
                        >
                          Hold to climb & fit ·{' '}
                          {Math.round(p.task.progress * 100)}%
                        </HoldButton>
                      )
                    ) : (
                      <div className="party-pad">
                        <HoldButton
                          aria-label="Turn left"
                          input={{ turn: -1 }}
                          onMove={controlInput}
                        >
                          ↶
                        </HoldButton>
                        <HoldButton
                          aria-label="Move load north"
                          input={{ z: -1 }}
                          onMove={controlInput}
                        >
                          ↑
                        </HoldButton>
                        <HoldButton
                          aria-label="Turn right"
                          input={{ turn: 1 }}
                          onMove={controlInput}
                        >
                          ↷
                        </HoldButton>
                        <HoldButton
                          aria-label="Move load west"
                          input={{ x: -1 }}
                          onMove={controlInput}
                        >
                          ←
                        </HoldButton>
                        <HoldButton
                          aria-label="Move load south"
                          input={{ z: 1 }}
                          onMove={controlInput}
                        >
                          ↓
                        </HoldButton>
                        <HoldButton
                          aria-label="Move load east"
                          input={{ x: 1 }}
                          onMove={controlInput}
                        >
                          →
                        </HoldButton>
                      </div>
                    )}
                    <div className="party-buttons">
                      <button
                        onClick={() =>
                          void act({ type: 'party', op: 'release' })
                        }
                      >
                        Release role
                      </button>
                      {p.task.kind !== 'ladder' && (
                        <button
                          onClick={() =>
                            void act({ type: 'party', op: 'place' })
                          }
                        >
                          Confirm delivery
                        </button>
                      )}
                    </div>
                  </>
                )}
                <div className="party-load">
                  <span>Balance</span>
                  <meter min="0" max="1" value={1 - p.task.tilt} />
                </div>
                {p.task.damage > 0 && (
                  <p>
                    {p.task.kind === 'glass'
                      ? `Glass cracks: ${p.task.damage}/2`
                      : 'A little spill. You can recover the delivery.'}
                  </p>
                )}
                {!!p.task.cargo?.length && (
                  <button
                    onClick={() => {
                      const bag = p.task.cargo[0];
                      scene.goTo(
                        bag,
                        () => void act({ type: 'party', op: 'collect' }),
                        'To spilled bag',
                      );
                    }}
                  >
                    Collect spilled bag · {p.task.cargo.length} left
                  </button>
                )}
                {role < 0 && (
                  <button
                    className="party-link"
                    onClick={() => {
                      const target = p.task.origin;
                      scene.goTo(
                        target,
                        () => void act({ type: 'party', op: 'recover' }),
                        'To delivery recovery',
                      );
                    }}
                  >
                    Recover delivery at collection bay
                  </button>
                )}
              </>
            )}
          {s.mission && !broadcast && (
            <>
              <button
                className="party-secret"
                onClick={() => {
                  if (!cardOpen) audio?.play('party.card.reveal');
                  setCardOpen((v) => !v);
                }}
              >
                {s.mission.done ? '✓ Secret job complete' : 'Your secret job'}{' '}
                {cardOpen ? '−' : '+'}
              </button>
              {cardOpen && (
                <div className="party-card">
                  <b>{s.mission.title}</b>
                  <p>{s.mission.text}</p>
                  {s.mission.paused && (
                    <small>Waiting for a suitable partner.</small>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}
      {p.phase === 'lastCall' && (
        <output className="party-last-call">
          <b>THE CUSTOMER IS ON THE WAY</b>
          <span>
            {Math.max(0, Math.ceil((p.deadline - s.now) / 1000))} seconds to
            look professional.
          </span>
        </output>
      )}
      {(p.phase === 'inspection' || p.phase === 'results') && (
        <section className="party-result" aria-label="Customer inspection">
          <span className="party-eyebrow">
            {p.phase === 'inspection' ? 'THE MOMENT OF TRUTH' : 'CLOCKING OFF'}
          </span>
          <h1>{p.result?.title}</h1>
          <DisasterChallenge
            key={p.roundId}
            snapshot={s}
            session={session}
            notify={notify}
            onSaved={setSavedBuildId}
          />
          <InspectionPanel
            snapshot={s}
            host={host}
            act={(a) => void act(a)}
            move={() => {}}
          />
          {p.phase === 'inspection' ? (
            <>
              <p className="party-verdict">
                “
                {
                  p.result?.comments[
                    Math.min(2, Math.floor((s.now - p.phaseAt) / 10000))
                  ]
                }
                ”
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={followInspector}
                  onChange={(e) => {
                    setFollowInspector(e.target.checked);
                    scene.setInspectionFollow(e.target.checked);
                  }}
                />{' '}
                Follow the inspector’s camera
              </label>
              {host && (
                <button onClick={() => void act({ type: 'party', op: 'skip' })}>
                  Show the results
                </button>
              )}
            </>
          ) : (
            <>
              <div className="party-awards">
                {p.result?.awards.map((a) => (
                  <div key={a.title}>
                    <b>{a.title}</b>
                    <span>{a.text}</span>
                  </div>
                ))}
              </div>
              {!!p.result?.cards.length && (
                <details>
                  <summary>So that’s why you did that…</summary>
                  {p.result.cards.map((c, i) => (
                    <p key={i}>
                      <b>
                        {c.name} ·{' '}
                        {c.done ? '✓' : c.paused ? 'Paused' : 'Nice try'}
                      </b>
                      <br />
                      {c.text}
                    </p>
                  ))}
                </details>
              )}
              <CrewScrapbook party={p} />
              <BuildShelf
                session={session}
                notify={notify}
                onSaved={setSavedBuildId}
              />
              {!!highlights.length && (
                <button onClick={openMedia}>
                  Watch {highlights.length} recorded highlights
                </button>
              )}
              <div className="party-buttons">
                <button
                  onClick={() => {
                    openMedia();
                    void picture();
                  }}
                >
                  Make a postcard
                </button>
                <button onClick={() => void shareChallenge()}>
                  Copy job recipe
                </button>
              </div>
              {host && (
                <button
                  onClick={() =>
                    void connection
                      .action({ type: 'reset', mode: 'job', retry: true })
                      .catch((e) => notify(e.message))
                  }
                >
                  Rematch this job
                </button>
              )}
              {host ? (
                <button
                  className="party-primary"
                  onClick={() =>
                    void connection
                      .action({ type: 'reset', mode: 'job' })
                      .catch((e) => notify(e.message))
                  }
                >
                  New job →
                </button>
              ) : (
                <p>Waiting for the site manager to open the next shift.</p>
              )}
            </>
          )}
        </section>
      )}
      {compact && p.recording.length > 0 && (
        <output className="mobile-recording-indicator">● Recording</output>
      )}
      {compact && !active && (
        <button
          className="mobile-social-shortcut"
          onClick={() => onMobilePanel('social')}
        >
          Voice & clips
        </button>
      )}
      {compact &&
        active &&
        role >= 0 &&
        !inputBlocked &&
        p.task.phase !== 'done' && (
          <section
            className="mobile-delivery-controls"
            aria-label="Carry controls"
          >
            <div className="mobile-delivery-status">
              <span>
                {p.task.phase === 'waiting'
                  ? 'Waiting for partner'
                  : p.task.kind === 'ladder'
                    ? role === 0 && !p.task.solo
                      ? 'Holding ladder'
                      : `Fitting sign · ${Math.round(p.task.progress * 100)}%`
                    : p.task.kind === 'crane' && role === 1 && !p.task.solo
                      ? 'Spotter · guide the landing'
                      : 'Joystick moves the load'}
              </span>
              <meter
                aria-label="Load balance"
                min="0"
                max="1"
                value={1 - p.task.tilt}
              />
            </div>
            <div className="party-buttons">
              {p.task.kind === 'ladder' ? (
                role === 0 && !p.task.solo ? (
                  <span>Holding the ladder</span>
                ) : (
                  <HoldButton
                    input={{ work: true }}
                    onMove={controlInput}
                    disabled={p.task.phase !== 'working'}
                  >
                    Hold to climb & fit
                  </HoldButton>
                )
              ) : (
                <>
                  {!(p.task.kind === 'crane' && role === 1 && !p.task.solo) && (
                    <>
                      <HoldButton
                        aria-label="Turn load left"
                        disabled={p.task.phase !== 'working'}
                        input={{ turn: -1 }}
                        onMove={controlInput}
                      >
                        ↶ Turn
                      </HoldButton>
                      <HoldButton
                        aria-label="Turn load right"
                        disabled={p.task.phase !== 'working'}
                        input={{ turn: 1 }}
                        onMove={controlInput}
                      >
                        Turn ↷
                      </HoldButton>
                    </>
                  )}
                  <TouchActionButton
                    actionKey={`deliver:${p.roundId}:${p.task.phase}:${role}:${p.task.deliveries}`}
                    disabled={!canDeliver}
                    onAction={() => void act({ type: 'party', op: 'place' })}
                  >
                    {p.task.dropVotes.includes(session.id)
                      ? 'Waiting for partner'
                      : p.task.dropVotes.length
                        ? 'Deliver · 1/2 ready'
                        : 'Deliver'}
                  </TouchActionButton>
                </>
              )}
              <TouchActionButton
                actionKey={`release:${p.roundId}:${role}`}
                label="Release delivery role"
                onAction={() => void act({ type: 'party', op: 'release' })}
              >
                Release role
              </TouchActionButton>
            </div>
          </section>
        )}
      {compact &&
        active &&
        !inputBlocked &&
        role < 0 &&
        (!p.swap || p.swap.stage !== 'design') && (
          <section
            className="mobile-task-actions"
            aria-label="Delivery actions"
          >
            {leak && p.inspection ? (
              <button
                onClick={() =>
                  walkAndAct(
                    {
                      x: p.inspection!.target.x,
                      z: p.inspection!.target.z + 2,
                    },
                    { type: 'party', op: 'repair' },
                    'To leaking pipe',
                  )
                }
              >
                Fix pipe
              </button>
            ) : null}
            {p.inspection &&
              p.task.phase === 'working' &&
              p.task.tilt >= 0.25 &&
              s.now >= p.inspection.nextSteadyAt && (
                <button
                  onClick={() =>
                    walkAndAct(
                      p.task,
                      { type: 'party', op: 'steady' },
                      'To steady the sofa',
                    )
                  }
                >
                  Steady sofa
                </button>
              )}
            {p.task.cargo?.length ? (
              <button
                onClick={() =>
                  walkAndAct(
                    p.task.cargo[0],
                    { type: 'party', op: 'collect' },
                    'To spilled bag',
                  )
                }
              >
                Collect bag · {p.task.cargo.length}
              </button>
            ) : null}
            {p.task.phase === 'spilled' && !p.task.roles.some(Boolean) && (
              <button
                onClick={() =>
                  walkAndAct(
                    p.task.origin,
                    { type: 'party', op: 'recover' },
                    'To collection bay',
                  )
                }
              >
                Recover delivery
              </button>
            )}
            {!leak &&
              !p.task.cargo?.length &&
              !['done', 'spilled'].includes(p.task.phase) &&
              p.task.roles.map((id, index) =>
                !id && (index === 0 || s.players.length > 1) ? (
                  <button
                    key={index}
                    disabled={
                      s.world.pieces.some(
                        (part) => part.heldBy === session.id,
                      ) || !!s.world.crane
                    }
                    onClick={() => take(index)}
                  >
                    {p.task.kind === 'ladder'
                      ? index
                        ? 'Climb ladder'
                        : 'Hold ladder'
                      : p.task.kind === 'crane'
                        ? index
                          ? 'Be spotter'
                          : 'Operate crane'
                        : `Take handle ${index + 1}`}
                  </button>
                ) : null,
              )}
          </section>
        )}
      {compact && voice.connected && !inputBlocked && (
        <div className="mobile-voice-controls" aria-label="Voice controls">
          {ptt ? (
            <HoldControl
              disabled={!armed}
              onHeld={(held) => {
                void voiceRef.current?.microphone(held);
              }}
              label="Hold to talk"
            >
              <Mic size={16} />
              <span>Hold to talk</span>
            </HoldControl>
          ) : (
            <button
              onClick={() => void microphone()}
              aria-label={voice.mic ? 'Mute microphone' : 'Unmute microphone'}
            >
              {voice.mic ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
          )}
          {p.voiceMode === 'proximity' && active && (
            <HoldControl
              disabled={!armed}
              onHeld={(held) => radio(held)}
              label="Hold site radio"
            >
              <Radio size={16} />
              <span>Radio</span>
            </HoldControl>
          )}
        </div>
      )}
      <aside className="party-voice">
        {compact && (
          <div className="mobile-sheet-heading">
            <h2>Voice & clips</h2>
            <button
              aria-label="Close voice and clips"
              onClick={() => {
                setMediaOpen(false);
                onMobilePanel(null);
              }}
            >
              <X size={20} />
            </button>
          </div>
        )}
        <details ref={voiceDetails}>
          <summary>
            <span className={voice.connected ? 'voice-dot on' : 'voice-dot'} />
            {voice.status}
            {voice.mic ? ' · mic on' : ''}
          </summary>
          {!voice.connected ? (
            <button
              className="party-primary"
              disabled={voice.status === 'Connecting…'}
              onClick={() => void joinVoice()}
            >
              Join voice
            </button>
          ) : (
            <>
              <button onClick={() => void microphone()}>
                {armed ? 'Disable microphone' : 'Enable microphone'}
              </button>
              <label>
                <input
                  type="checkbox"
                  checked={ptt}
                  onChange={(e) => {
                    setPtt(e.target.checked);
                    if (armed)
                      void voiceRef.current?.microphone(!e.target.checked);
                  }}
                />{' '}
                Push-to-talk
              </label>
              {ptt && (
                <>
                  <label>
                    Talk key
                    <select
                      value={pttKey}
                      onChange={(e) => setPttKey(e.target.value)}
                    >
                      <option value="KeyT">T</option>
                      <option value="KeyG">G</option>
                      <option value="KeyH">H</option>
                    </select>
                  </label>
                  <HoldControl
                    disabled={!armed}
                    onHeld={(held) => {
                      void voiceRef.current?.microphone(held);
                    }}
                    label="Hold to talk"
                  >
                    Hold to talk
                  </HoldControl>
                </>
              )}
              {!!devices.length && (
                <label>
                  Microphone
                  <select
                    onChange={(e) =>
                      void voiceRef.current?.microphone(
                        armed && !ptt,
                        e.target.value,
                      )
                    }
                  >
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
                <meter value={voice.level} min="0" max="1" />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={duck}
                  onChange={(e) => setDuck(e.target.checked)}
                />{' '}
                Lower game audio during conversations
              </label>
              {s.players
                .filter((v) => v.id !== session.id)
                .map((v) => (
                  <label key={v.id}>
                    {voice.speaking.includes(v.id) ? '● ' : ''}
                    {v.name}
                    <input
                      type="range"
                      aria-label={`${v.name} volume; zero mutes`}
                      min="0"
                      max="2"
                      step=".05"
                      defaultValue="1"
                      onChange={(e) =>
                        voiceRef.current?.volume(v.id, Number(e.target.value))
                      }
                    />
                  </label>
                ))}
              {p.voiceMode === 'proximity' && active && (
                <HoldControl
                  disabled={!armed}
                  onHeld={(held) => radio(held)}
                  label="Hold site radio · everyone hears"
                >
                  Hold site radio · everyone hears
                </HoldControl>
              )}
            </>
          )}
          {voice.error && <output>{voice.error}</output>}
          <label>
            <input
              type="checkbox"
              checked={p.audioConsent.includes(session.id)}
              onChange={(e) =>
                void act({
                  type: 'party',
                  op: 'consent',
                  enabled: e.target.checked,
                })
              }
            />{' '}
            Allow my voice in this room’s game clips
          </label>
        </details>
        <button
          className="party-media-toggle"
          onClick={() => {
            setMediaOpen((v) => !v);
            if (compact) onMobilePanel('social');
          }}
        >
          Postcards & clips {recording ? '●' : ''}
        </button>
        {p.recording.length > 0 && (
          <output>
            ●{' '}
            {p.recording
              .map(
                (id) => s.players.find((v) => v.id === id)?.name || 'A builder',
              )
              .join(', ')}{' '}
            recording game clips
          </output>
        )}
      </aside>
      {mediaOpen && (!compact || mobilePanel === 'social') && (
        <section className="party-media" aria-label="Postcards and clips">
          <div className="party-buttons">
            <h2>Keep the evidence.</h2>
            <button
              aria-label="Close media panel"
              onClick={() => setMediaOpen(false)}
            >
              ×
            </button>
          </div>
          <label>
            <input
              type="checkbox"
              checked={portrait}
              disabled={recording}
              onChange={(e) => setPortrait(e.target.checked)}
            />{' '}
            Portrait photo & video (follows the action)
          </label>
          <label>
            <input
              type="checkbox"
              checked={showNames}
              disabled={recording}
              onChange={(e) => setShowNames(e.target.checked)}
            />{' '}
            Include player names in exports
          </label>
          <button disabled={mediaBusy} onClick={() => void picture()}>
            Preview postcard
          </button>
          <button onClick={() => void shareChallenge()}>Copy job recipe</button>
          <BuildShelf
            session={session}
            notify={notify}
            onSaved={setSavedBuildId}
          />
          <hr />
          <label>
            <input
              type="checkbox"
              checked={includeVoice}
              disabled={recording || !voice.connected}
              onChange={(e) => setIncludeVoice(e.target.checked)}
            />{' '}
            Include consenting voices in clips
          </label>
          <label>
            <input
              type="checkbox"
              checked={shortRecording}
              disabled={recording}
              onChange={(e) => setShortRecording(e.target.checked)}
            />{' '}
            Short recording from now (up to 30 seconds)
          </label>
          <p>{recordText}</p>
          {!!highlights.length && (
            <div className="party-highlights">
              <b>Your recorded highlights</b>
              {highlights.map((h) => (
                <button
                  key={h.id}
                  onClick={() =>
                    setPreview({
                      blob: h.blob,
                      type: 'video',
                      url: URL.createObjectURL(h.blob),
                    })
                  }
                >
                  {h.text}
                </button>
              ))}
            </div>
          )}
          <small>
            When recording is enabled, up to three inspection highlights are
            kept on this device. Stopping recording or withdrawing voice consent
            clears them.
          </small>
          <div className="party-buttons">
            <button
              disabled={mediaBusy}
              onClick={() =>
                recording ? void stopRecording() : void startRecording()
              }
            >
              {recording ? 'Stop recording' : 'Enable local recording'}
            </button>
            <button
              disabled={(!recording && !canSave) || mediaBusy}
              onClick={() => void saveMoment()}
            >
              Save moment
            </button>
          </div>
          <small>
            Clips use your current view. Private job cards and room codes are
            excluded. Nothing is uploaded automatically.
          </small>
          {preview && (
            <div className="party-preview">
              {preview.type === 'video' ? (
                <video src={preview.url} controls playsInline />
              ) : (
                <img src={preview.url} alt="Your construction postcard" />
              )}
              <div className="party-buttons">
                <button
                  onClick={() =>
                    downloadBlob(
                      preview.blob,
                      `permit-pending.${preview.type === 'image' ? 'png' : preview.blob.type.includes('mp4') ? 'mp4' : 'webm'}`,
                    )
                  }
                >
                  Download
                </button>
                <button onClick={() => void shareFile()}>Share file</button>
                <button onClick={() => setPreview(null)}>Discard</button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function HoldButton({
  input,
  onMove,
  children,
  'aria-label': label,
  disabled,
}: {
  input: Partial<CrewControls>;
  onMove: (input: Partial<CrewControls>, source: string) => void;
  children: React.ReactNode;
  'aria-label'?: string;
  disabled?: boolean;
}) {
  return (
    <HoldControl
      label={label}
      disabled={disabled}
      onHeld={(held, source) => onMove(held ? input : {}, source)}
    >
      {children}
    </HoldControl>
  );
}
