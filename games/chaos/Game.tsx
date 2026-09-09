'use client';
/* oxlint-disable react/react-compiler -- This uncompiled WebGL host synchronizes mutable scene controllers and saved browser state; hook rules and exhaustive dependencies remain enforced. */
/* oxlint-disable jsx-a11y/autocomplete-valid -- nickname is a standard HTML autocomplete token. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- HUD live regions use styled containers with explicit ARIA semantics. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  HardHat,
  Users,
  Hammer,
  Volume2,
  Settings2,
  Maximize,
  ArrowUpRight,
  Check,
  Copy,
  X,
  RotateCw,
  RotateCcw,
  MousePointer2,
  Camera,
  Hand,
  Send,
  Smile,
  Timer,
  Plus,
  Minus,
  LogOut,
  Construction,
  BookOpen,
  Trophy,
  Wind,
  ChevronDown,
  Share2,
  Scan,
  Eye,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  CATALOG,
  JOBS,
  PLAYER_COLORS,
  freshWorld,
  jobProgress,
  placementError,
  ROUND_SECONDS,
  type Snapshot,
  type Mode,
  type ItemKind,
  type Action,
} from './model';
import { Connection, requestRoom, type Session } from './connection';
import { GameAudio } from './sound';
import { PROP_USES } from './house-props';
import { BuildKit } from './BuildKit';
import { ActiveBuildPart } from './ActiveBuildPart';
import { SiteTools } from './SiteTools';
import './workspace-ui.css';
import { HomeProjects } from './HomeProjects';
import { homeProgress } from './home-projects';
import { finishesFor, paintHex, type PaintId, type Finish } from './appearance';
import './home-design.css';
import { chaosCue } from './audio-events';

import type { BuildPreview, GameScene } from './scene';
import { COMPACT_QUERY, TOUCH_QUERY } from './touch';
import {
  describeTarget,
  mobileActions,
  type InteractionTarget,
  type MobileAction,
} from './mobile-actions';
import { MobileActionHud } from './MobileActionHud';
import { removalSupportError } from './structure';
import { TouchControls } from './TouchControls';
import { pieceShape } from './colliders';
import { CraneControls } from './CraneControls';
import { MAPS, mapConfig, onFoundation, type MapId } from './maps';
import { surfaceHeight } from './colliders';
import { woodenSurface } from './levels';
import { BuildShelf } from './BuildShelf';
import './saved-build.css';
import { PartyPanel } from './PartyPanel';
import GameToolbar from '../../shared/ui/GameToolbar';
import './mobile-play.css';
export type MobilePanel = 'crew' | 'social' | 'camera' | 'tools' | null;
import { parseChallenge, CREW_JOBS } from './party';

const preview: Snapshot = {
  world: freshWorld('sandbox', 0),
  code: '',
  host: 'preview',
  version: 0,
  now: 0,
  players: [
    {
      id: 'preview',
      name: 'Ready to build',
      color: 0,
      x: 1,
      z: 3.5,
      angle: 0.3,
      seen: 0,
    },
    {
      id: 'preview2',
      name: 'Sofa service',
      color: 1,
      x: 5.5,
      z: 0.1,
      angle: -0.9,
      seen: 0,
    },
  ],
};

export default function Game() {
  'use no memo'; // This component bridges an imperative WebGL simulation.
  const mount = useRef<HTMLDivElement>(null);
  const scene = useRef<GameScene | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState(0);
  const [map, setMap] = useState<MapId>('small');
  const [firstPerson, setFirstPerson] = useState(false);
  const [mode, setMode] = useState<Mode>('job');
  const [code, setCode] = useState('');
  const [sharedBuild, setSharedBuild] = useState<{
    id: string;
    mode: 'try' | 'explore' | 'remix';
  } | null>(null);
  const [challenge, setChallenge] =
    useState<ReturnType<typeof parseChallenge>>(null);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(true);
  const [broadcast, setBroadcast] = useState(false);
  const [gameVolume, setGameVolume] = useState(0.8);
  const [help, setHelp] = useState(false);
  const [voiceRequest, setVoiceRequest] = useState(0);
  const [settings, setSettings] = useState(false);
  const [joining, setJoining] = useState(false);
  const [state, setState] = useState<Snapshot | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('online');
  const [category, setCategory] = useState('House');
  const [buildOpen, setBuildOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [selected, setSelected] = useState<ItemKind>('wall');
  const [rotation, setRotation] = useState(0);
  const [buildLevel, setBuildLevel] = useState(0);
  const [craneMode, setCraneMode] = useState(false);
  const [demolish, setDemolish] = useState(false);
  const [paint, setPaint] = useState<PaintId>('original');
  const [finish, setFinish] = useState<Finish>('classic');
  const [painting, setPainting] = useState(false);
  const [wholeHouse, setWholeHouse] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const selectedAppearance = useMemo(
    () => ({
      paint,
      finish: (finishesFor(selected).some((f) => f.id === finish)
        ? finish
        : 'classic') as Finish,
    }),
    [paint, finish, selected],
  );
  const paintActive = painting && buildOpen && !craneMode && !demolish;
  const [toast, setToast] = useState('');
  const [copied, setCopied] = useState(false);
  const [invite, setInvite] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [nearby, setNearby] = useState('');
  const [workLabel, setWorkLabel] = useState('');
  const [buildPreview, setBuildPreview] = useState<BuildPreview | null>(null);
  const [dismissedResult, setDismissedResult] = useState(false);
  const [resetMode, setResetMode] = useState<Mode | null>(null);
  const [lowQuality, setLowQuality] = useState(false);
  const [resumeSession, setResumeSession] = useState<Session | null>(null);
  const [compact, setCompact] = useState(false);
  const [touchInput, setTouchInput] = useState(false);
  const [interaction, setInteraction] = useState<InteractionTarget | null>(
    null,
  );
  const [dropIssue, setDropIssue] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionFeedback, setActionFeedback] = useState('');
  const [selectedRoof, setSelectedRoof] = useState<string | null>(null);
  const [contractOpen, setContractOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const openMobilePanel = useCallback((panel: MobilePanel) => {
    setContractOpen(false);
    setCatalogOpen(false);
    setMobilePanel(panel);
  }, []);
  const [pending, setPending] = useState<{
    x: number;
    z: number;
    id?: string;
    level?: number;
  } | null>(null);
  const connection = useRef<Connection | null>(null);
  const audio = useRef<GameAudio | null>(null);
  const stateRef = useRef<Snapshot | null>(null);
  const actions = useRef<(type: string) => void>(() => {});
  const positioned = useRef<(x: number, z: number) => void>(() => {});
  const clicked = useRef<(x: number, z: number, id?: string) => void>(() => {});
  const actionBusy = useRef(false);
  const heard = useRef(new Set<string>());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function notify(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3600);
  }
  function accept(next: Snapshot) {
    if (
      stateRef.current?.world.party?.roundId !== next.world.party?.roundId ||
      stateRef.current?.world.party?.phase !== next.world.party?.phase
    ) {
      setMobilePanel(null);
      setContractOpen(false);
    }
    if (stateRef.current?.code === next.code && next.world.mode === 'sandbox') {
      const before = homeProgress(stateRef.current.world);
      const earned = homeProgress(next.world).find(
        (p, i) => p.complete && !before[i].complete,
      );
      if (earned)
        notify(`Home project complete: ${earned.title} · ${earned.reward}!`);
    }
    stateRef.current = next;
    setState(next);
    scene.current?.setState(next, connection.current?.session.id);
    for (const event of next.world.events)
      if (!heard.current.has(event.id) && event.at <= next.now) {
        heard.current.add(event.id);
        if (next.now - event.at < 1400) {
          const cue = chaosCue(event);
          if (cue) {
            const p = scene.current?.local;
            const gain = p
              ? 1 / (1 + Math.hypot(p.x - event.x, p.z - event.z) * 0.12)
              : 1;
            audio.current?.play(cue, gain);
            const reaction =
              cue === 'party.lift'
                ? 'lift'
                : cue === 'party.recover'
                  ? 'recover'
                  : cue === 'party.delivered'
                    ? 'delivered'
                    : /party\.(sofa\.spill|glass\.(crack|break)|barrow\.spill|ladder\.fall)/.test(
                          cue,
                        )
                      ? 'spill'
                      : null;
            if (reaction && gain > 0.4)
              audio.current?.play('speech.crew.' + reaction, gain);
          }
          if (['bonk', 'wind', 'emote'].includes(event.type))
            notify(event.text);
        }
      }
    if (heard.current.size > 100)
      heard.current = new Set(next.world.events.map((e) => e.id));
  }
  function enter(s: Session, initial: Snapshot) {
    connection.current?.stop();
    const conn = new Connection(s, accept, (status, message) => {
      setConnectionStatus(status);
      if (message) notify(message);
    });
    connection.current = conn;
    const player = initial.players.find((p) => p.id === s.id)!;
    conn.position = {
      x: player.x,
      y: player.y,
      z: player.z,
      angle: player.angle,
      jump: 0,
    };
    if (scene.current) {
      scene.current.local = null;
      scene.current.setMenu(false);
    }
    setPainting(false);
    setProjectsOpen(false);
    setCraneMode(false);
    setFirstPerson(false);
    scene.current?.setFirstPerson(false);
    setSession(s);
    setInvite(false);
    setSettings(false);
    setDismissedResult(false);
    setBuildOpen(false);
    setCatalogOpen(true);
    setDemolish(false);
    setSelected('wall');
    setCategory('House');
    setError('');
    conn.accept(initial);
    void conn.poll();
    try {
      sessionStorage.setItem('pfusch-session', JSON.stringify(s));
      localStorage.setItem('pfusch-name', name || player.name);
      localStorage.setItem('pfusch-color', String(color));
    } catch {}
    setResumeSession(null);
    history.replaceState(null, '', `${location.pathname}?raum=${s.code}`);
    setPending(null);
    setContractOpen(false);
    notify(
      'Drag the joystick to walk. Select an object, then choose Pick up. Build on site.',
    );
  }
  async function perform(action: Action) {
    if (
      !connection.current ||
      actionBusy.current ||
      connectionStatus !== 'online'
    )
      return false;
    actionBusy.current = true;
    setActionPending(true);
    setActionFeedback('');
    if (scene.current?.local) {
      const p = scene.current.local;
      connection.current.position = {
        x: p.x,
        y: p.y,
        z: p.z,
        angle: p.angle,
        jump: p.jump || 0,
      };
    }
    try {
      await connection.current.action(action);
      return true;
    } catch (error) {
      audio.current?.play('event.error');
      notify((error as Error).message);
      setActionFeedback((error as Error).message);
      return false;
    } finally {
      actionBusy.current = false;
      setActionPending(false);
    }
  }
  async function leave() {
    void connection.current?.leave();
    connection.current = null;
    setCraneMode(false);
    setFirstPerson(false);
    scene.current?.setFirstPerson(false);
    setState(null);
    stateRef.current = null;
    setSession(null);
    setSettings(false);
    setBuildOpen(false);
    setInvite(false);
    setResetMode(null);
    setConnectionStatus('online');
    if (scene.current) {
      scene.current.local = null;
      scene.current.setTool(null, 0);
      scene.current.setMenu(true);
      scene.current.setState({ ...preview, now: Date.now() });
    }
    try {
      sessionStorage.removeItem('pfusch-session');
    } catch {}
    history.replaceState(null, '', location.pathname);
  }
  async function share(native = false) {
    if (!session) return;
    const url = `${location.origin}${location.pathname}?raum=${session.code}`;
    if (native && navigator.share) {
      try {
        await navigator.share({
          title: 'PERMIT PENDING',
          text: 'Hard hat on! Come build with me.',
          url,
        });
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setInvite(true);
    }
  }

  useEffect(() => {
    let disposed = false;
    const media = window.matchMedia(COMPACT_QUERY);
    setTouchInput(window.matchMedia(TOUCH_QUERY).matches);
    const updateCompact = () => setCompact(media.matches);
    updateCompact();
    setLowQuality(media.matches);
    media.addEventListener('change', updateCompact);
    import('./scene')
      .then(({ GameScene }) => {
        if (disposed || !mount.current) return;
        try {
          scene.current = new GameScene(mount.current, {
            input: setTouchInput,
            move: (x, z, angle, jump, y) => {
              if (connection.current)
                connection.current.position = { x, y, z, angle, jump };
            },
            click: (x, z, id) => clicked.current(x, z, id),
            positionBuild: (x, z) => positioned.current(x, z),
            action: (type) => actions.current(type),
            ready: () => setReady(true),
            feedback: notify,
          });
          scene.current.setState({ ...preview, now: Date.now() });
          setThumbnails(scene.current.thumbnails(CATALOG.map((i) => i.id)));
        } catch {
          setError(
            'This 3D building site needs WebGL 2. Open it in an up-to-date Safari, Chrome, Edge or Firefox.',
          );
        }
      })
      .catch(() =>
        setError('The building site could not load. Please reload the page.'),
      );
    audio.current = new GameAudio();
    try {
      setName(localStorage.getItem('pfusch-name') || '');
      setColor(Number(localStorage.getItem('pfusch-color')) || 0);
      const saved = sessionStorage.getItem('pfusch-session');
      if (saved) setResumeSession(JSON.parse(saved));
    } catch {}
    try {
      const value = parseChallenge(new URLSearchParams(location.search));
      if (value) {
        setChallenge(value);
        setMap(value.map);
        setMode('job');
      }
    } catch (error) {
      setError((error as Error).message);
    }
    const buildParams = new URLSearchParams(location.search),
      buildId = buildParams.get('build'),
      play = buildParams.get('play');
    if (buildId && /^[a-f0-9]{32}$/.test(buildId))
      setSharedBuild({
        id: buildId,
        mode:
          play === 'explore' ? 'explore' : play === 'remix' ? 'remix' : 'try',
      });
    const roomCode = new URLSearchParams(location.search).get('raum');
    if (roomCode) {
      setCode(roomCode.toUpperCase());
      setJoining(true);
    }
    return () => {
      disposed = true;
      media.removeEventListener('change', updateCompact);
      connection.current?.stop();
      scene.current?.dispose();
      audio.current?.dispose();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!session && ready && scene.current)
      scene.current.setState({
        ...preview,
        world: freshWorld('sandbox', 0, 0, map),
        now: Date.now(),
      });
  }, [map, ready, session]);
  useEffect(() => {
    if (audio.current) audio.current.enabled = sound;
  }, [sound]);
  const crane = state?.world.crane;
  const ownCrane = !!crane && crane.operatorId === session?.id;
  useEffect(() => {
    if (scene.current) {
      scene.current.craneMode = craneMode;
      if (craneMode) {
        scene.current.clearInput();
        scene.current.releaseLook();
      }
      scene.current.setTool(
        craneMode
          ? ownCrane && crane?.phase === 'ready'
            ? 'roof'
            : null
          : buildOpen && !paintActive
            ? selected
            : null,
        rotation,
        demolish,
        buildLevel,
        craneMode
          ? crane?.origin.supply
            ? { paint }
            : crane?.origin || {}
          : selectedAppearance,
        paintActive,
        selected === 'roof',
      );
      scene.current.updateCamera();
    }
  }, [
    craneMode,
    ownCrane,
    crane?.phase,
    buildOpen,
    selected,
    rotation,
    demolish,
    buildLevel,
    paint,
    finish,
    paintActive,
    crane?.origin,
    selectedAppearance,
    ready,
  ]);
  useEffect(() => {
    if (buildOpen) scene.current?.releaseLook();
  }, [buildOpen]);
  useEffect(() => {
    if (buildOpen && selected === 'roof' && !painting) {
      setCraneMode(true);
      setBuildOpen(false);
      setDemolish(false);
      setPending(null);
      scene.current?.cancelWork();
    }
  }, [buildOpen, selected, painting]);
  useEffect(() => {
    if (crane?.phase === 'ready') setPending(null);
  }, [crane?.phase]);
  useEffect(() => {
    scene.current?.setQuality(lowQuality);
  }, [lowQuality, ready]);
  useEffect(() => {
    if (scene.current) {
      scene.current.updateCamera();
    }
  }, [compact, ready]);
  useEffect(() => {
    if (scene.current) scene.current.touchMode = touchInput;
  }, [touchInput, ready]);
  useEffect(() => {
    if (!compact || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const resize = () => {
      root.style.setProperty(
        '--permit-dialog-height',
        `${Math.max(120, viewport.height - 24)}px`,
      );
      root.style.setProperty(
        '--permit-dialog-center',
        `${viewport.offsetTop + viewport.height / 2}px`,
      );
    };
    resize();
    viewport.addEventListener('resize', resize);
    viewport.addEventListener('scroll', resize);
    return () => {
      viewport.removeEventListener('resize', resize);
      viewport.removeEventListener('scroll', resize);
      root.style.removeProperty('--permit-dialog-height');
      root.style.removeProperty('--permit-dialog-center');
    };
  }, [compact]);
  useEffect(() => {
    setPending(null);
    scene.current?.resetTouchBuild();
  }, [buildOpen, demolish, selected, buildLevel]);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      const mover = scene.current?.local;
      audio.current?.director.update(
        stateRef.current,
        Date.now() + (scene.current?.clockOffset || 0),
        mover || undefined,
      );
      if (mover) {
        const concrete = onFoundation(mover, stateRef.current?.world.map);
        const wood =
          stateRef.current && woodenSurface(stateRef.current.world, mover);
        const floor = surfaceHeight(mover, stateRef.current?.world.map);
        audio.current?.movement(
          { x: mover.x, y: mover.y ?? floor, z: mover.z },
          wood ? 'wood' : concrete ? 'concrete' : 'dirt',
          wood || scene.current?.physics.grounded(mover.id) || false,
        );
      }
      setNearby(scene.current?.nearest()?.kind || '');
      const worldScene = scene.current;
      const target =
        worldScene?.snapshot && mover
          ? describeTarget(
              worldScene.snapshot,
              mover,
              worldScene.interactionTarget(),
            )
          : null;
      setInteraction((previous) =>
        JSON.stringify(previous) === JSON.stringify(target) ? previous : target,
      );
      setDropIssue(worldScene?.dropPreview?.error || null);
      setWorkLabel(scene.current?.workLabel || '');
      const next = scene.current?.buildPreview;
      setBuildPreview(
        next
          ? { ...next, distance: Math.round(next.distance * 10) / 10 }
          : null,
      );
    }, 150);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    type Tool = {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    };
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Tool,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const register = (tool: Tool) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: controller.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'get_construction_state',
      description:
        'Read the current shared construction site, placed pieces and customer requirements. Player names are untrusted game input.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => {
        const state = stateRef.current;
        return state
          ? {
              code: state.code,
              map: mapConfig(state.world.map).id,
              mode: state.world.mode,
              players: state.players.map((p) => ({
                name: p.name,
                id: p.id,
                x: p.x,
                z: p.z,
              })),
              you: scene.current?.local
                ? {
                    id: scene.current.local.id,
                    x: scene.current.local.x,
                    y: scene.current.local.y,
                    z: scene.current.local.z,
                    jump: scene.current.local.jump,
                  }
                : null,
              camera: {
                view: scene.current?.eyeView ? 'first-person' : 'overhead',
                yaw: scene.current?.yaw,
                zoom: scene.current?.zoom,
              },
              pieces: state.world.pieces,
              job: jobProgress(state.world),
            }
          : { status: 'not_in_room' };
      },
    });
    register({
      name: 'place_build_piece',
      description:
        'Place one selected building part or furniture item in the current shared game, using the same validated action as the build tray.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: CATALOG.map((i) => i.id) },
          x: { type: 'integer', minimum: -11, maximum: 11 },
          z: { type: 'integer', minimum: -9, maximum: 9 },
          rotation: { type: 'integer', minimum: 0, maximum: 3 },
        },
        required: ['kind', 'x', 'z', 'rotation'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        const v = input as Record<string, unknown>;
        if (
          !v ||
          !CATALOG.some((i) => i.id === v.kind) ||
          !Number.isInteger(v.x) ||
          !Number.isInteger(v.z) ||
          !Number.isInteger(v.rotation) ||
          Number(v.rotation) < 0 ||
          Number(v.rotation) > 3
        )
          throw new Error('Invalid building part or grid position.');
        if (!connection.current)
          throw new Error('Join a construction site first.');
        const next = await connection.current.action({
          type: 'build',
          kind: v.kind as ItemKind,
          x: v.x as number,
          z: v.z as number,
          rotation: v.rotation as number,
        });
        const item = CATALOG.find((i) => i.id === v.kind)!;
        setSelected(item.id);
        setCategory(item.category);
        return {
          placed: next.world.pieces.at(-1),
          progress: jobProgress(next.world).done,
        };
      },
    });
    return () => controller.abort();
  }, []);
  const progress = state ? jobProgress(state.world) : null;
  const elapsed = state
    ? Math.max(
        0,
        (now + (scene.current?.clockOffset || 0) - state.world.started) / 1000,
      )
    : 0;
  const remaining =
    state?.world.party?.phase === 'lobby'
      ? ROUND_SECONDS
      : state?.world.party?.deadline
        ? Math.max(
            0,
            Math.ceil(
              (state.world.party.deadline -
                (now + (scene.current?.clockOffset || 0))) /
                1000,
            ),
          )
        : Math.max(0, ROUND_SECONDS - Math.floor(elapsed));
  const finished =
    !!state &&
    state.world.mode === 'job' &&
    (state.world.party
      ? ['inspection', 'results'].includes(state.world.party.phase)
      : remaining === 0 || progress!.ratio >= 1);
  const isHost = !!session && state?.host === session.id;
  const held = state?.world.pieces.find((p) => p.heldBy === session?.id);
  const heldId = held?.id;
  const heldName = held ? CATALOG.find((i) => i.id === held.kind)?.name : '';
  const nearbyName = CATALOG.find((i) => i.id === nearby)?.name;
  const placementIssue =
    pending && state && buildOpen && !paintActive
      ? placementError(state.world, selected, pending, undefined, rotation)
      : null;
  const selectedPiece = state?.world.pieces.find((p) => p.id === pending?.id);
  const paintScope =
    wholeHouse &&
    selectedPiece &&
    ['wall', 'window', 'door'].includes(selectedPiece.kind)
      ? state?.world.pieces.filter(
          (p) =>
            p.placed &&
            !p.heldBy &&
            !p.hoisted &&
            onFoundation(p, state.world.map) &&
            ['wall', 'window', 'door'].includes(p.kind),
        ) || []
      : selectedPiece
        ? [selectedPiece]
        : [];
  const paintScopeIds = paintScope.map((part) => part.id).join('|');
  useEffect(() => {
    setActionFeedback('');
  }, [
    interaction?.id,
    heldId,
    selected,
    rotation,
    buildLevel,
    pending?.x,
    pending?.z,
    pending?.id,
    painting,
    demolish,
    craneMode,
  ]);
  useEffect(() => {
    if (!scene.current) return;
    scene.current.selectionIds = paintActive
      ? paintScopeIds.split('|').filter(Boolean)
      : demolish && pending?.id
        ? [pending.id]
        : craneMode && selectedRoof
          ? [selectedRoof]
          : [];
    scene.current.previewAppearance = paintActive ? selectedAppearance : null;
    scene.current.selectionColor = demolish
      ? '#a32925'
      : paintHex(selectedAppearance) || '#ffc83d';
  }, [
    pending?.id,
    paintActive,
    demolish,
    selectedAppearance,
    paintScopeIds,
    craneMode,
    selectedRoof,
  ]);
  const latestWind = 55 - (Math.floor(elapsed) % 55);

  const jobRound =
    session && state?.world.mode === 'job' && !state.world.party
      ? state.world.round
      : null;
  useEffect(() => {
    if (jobRound !== null && jobRound % JOBS.length < 3)
      audio.current?.play(`speech.job.${jobRound % JOBS.length}`);
  }, [jobRound, ready]);
  useEffect(() => {
    if (heldId) {
      setBuildOpen(false);
      setDemolish(false);
      setPending(null);
    }
  }, [heldId]);
  function workAt(
    action: Action,
    target: { x: number; z: number; level?: number },
    label: string,
    ignoreId?: string,
    onSuccess?: () => void,
  ) {
    if (connectionStatus !== 'online') return;
    const run = () => {
      void perform(action).then((success) => {
        if (success) onSuccess?.();
      });
    };
    if (action.type === 'build')
      target = { ...target, level: action.level ?? 0 };
    if (action.type === 'build' && state) {
      const error = placementError(
        state.world,
        action.kind,
        target,
        undefined,
        action.rotation,
      );
      if (error) {
        notify(error);
        return;
      }
    }
    if (scene.current?.eyeView && !(compact && action.type === 'build')) {
      if (
        !scene.current.canWork(
          target,
          ignoreId,
          action.type === 'build'
            ? { kind: action.kind, rotation: action.rotation }
            : undefined,
        )
      ) {
        notify('Walk closer to a clear spot within reach.');
        return;
      }
      run();
      return;
    }
    scene.current?.goTo(
      target,
      run,
      label,
      ignoreId,
      action.type === 'build'
        ? { kind: action.kind, rotation: action.rotation }
        : undefined,
    );
  }
  function toggleView() {
    const enabled = !firstPerson;
    setFirstPerson(enabled);
    scene.current?.setFirstPerson(enabled);
    if (enabled) scene.current?.requestLook();
  }
  function openCrane() {
    if (held) {
      notify('Put down your carried object first.');
      return;
    }
    scene.current?.cancelWork();
    setCraneMode(true);
    setBuildOpen(false);
    setDemolish(false);
    setPending(null);
    setSelectedRoof(null);
  }
  async function closeCrane() {
    if (ownCrane) {
      await perform({ type: 'crane-cancel' });
      if (stateRef.current?.world.crane?.operatorId === session?.id) return;
    }
    setCraneMode(false);
    setSelectedRoof(null);
    setPending(null);
    scene.current?.resetTouchBuild();
  }
  function placeRoof() {
    const target = pending || scene.current?.buildPreview;
    if (!target || !ownCrane || crane?.phase !== 'ready') return;
    void perform({
      type: 'crane-place',
      ...(crane?.origin.supply ? { paint } : {}),
      level: buildLevel,
      x: target.x,
      z: target.z,
      rotation,
    });
  }
  actions.current = (type) => {
    if (
      connectionStatus !== 'online' &&
      ['grab', 'use', 'throw', 'confirm', 'place-touch'].includes(type)
    )
      return;
    if (paintActive && ['confirm', 'place-touch'].includes(type)) {
      notify('Tap the placed part you want to paint.');
      return;
    }
    if (
      type === 'place-touch' ||
      (type === 'confirm' && compact && buildOpen && pending)
    ) {
      void confirmPlacement();
      return;
    }
    if (type === 'crane') {
      if (craneMode) void closeCrane();
      else openCrane();
      return;
    }
    if (craneMode) {
      if (type === 'escape') {
        void closeCrane();
        return;
      }
      if (type === 'rotate') {
        setRotation((v) => (v + 1) % 4);
        return;
      }
      if (type === 'confirm' || type === 'grab') {
        placeRoof();
        return;
      }
      if (['build', 'demolish', 'throw', 'view', 'use'].includes(type)) return;
    }
    if (type === 'build') {
      toggleBuild();
    }
    if (type === 'rotate') setRotation((v) => (v + 1) % 4);
    if (type === 'escape') {
      if (buildOpen && catalogOpen) {
        closeBuildCatalog();
        return;
      }
      if (compact && (pending || buildOpen || demolish)) {
        cancelTouchTool();
        return;
      }
      if (buildOpen || demolish) {
        setBuildOpen(false);
        setDemolish(false);
      } else setSettings(true);
    }
    if (type === 'view') {
      toggleView();
      return;
    }
    if (type === 'demolish') {
      setDemolish((v) => !v);
      setBuildOpen(false);
    }
    if (type === 'grab') {
      scene.current?.cancelWork();
      if (held) void perform({ type: 'drop' });
      else {
        const nearest = scene.current?.nearest();
        if (nearest) void perform({ type: 'grab', id: nearest.id });
        else
          notify(
            'Tap an object: your builder walks over and picks it up. Or walk into the yellow ring.',
          );
      }
    }
    if (type === 'use') {
      const prop = scene.current?.nearest();
      if (prop && PROP_USES[prop.kind])
        void perform({ type: 'use', id: prop.id });
      else
        notify(
          'Walk up to a usable prop: try the cooker, piano, television, aquarium or bubble bath.',
        );
      return;
    }
    if (type === 'throw') void perform({ type: 'throw' });
    if (type === 'emote') void perform({ type: 'emote' });
    if (type === 'confirm' && buildOpen) {
      const p = scene.current?.local;
      if (p) {
        const target = pending ||
          scene.current?.buildPreview || {
            x: Math.round(p.x + Math.sin(p.angle) * 1.8),
            z: Math.round(p.z + Math.cos(p.angle) * 1.8),
          };
        workAt(
          {
            type: 'build',
            ...selectedAppearance,
            level: buildLevel,
            kind: selected,
            ...target,
            rotation,
          },
          target,
          'To build location',
        );
        setPending(null);
      }
    }
    if (type.startsWith('slot-')) {
      const item = CATALOG.filter((i) => i.category === category)[
        Number(type.slice(5)) - 1
      ];
      if (item) chooseBuildPart(item.id);
    }
  };
  positioned.current = (x, z) => {
    if (
      !scene.current?.touchMode ||
      !buildOpen ||
      finished ||
      craneMode ||
      paintActive
    )
      return;
    setPending({ x, z, level: buildLevel });
    setCatalogOpen(false);
  };
  clicked.current = (x, z, id) => {
    if (
      finished ||
      modalOpen ||
      connectionStatus !== 'online' ||
      state?.world.party?.phase === 'lobby' ||
      mobileCrewRole ||
      actionBusy.current
    )
      return;
    const touching = scene.current?.touchMode;
    if (craneMode) {
      if (crane && !ownCrane) {
        notify('The crane is in use by another builder.');
        return;
      }
      if (!crane) {
        if (id && touching) {
          setSelectedRoof(id);
          setPending(null);
        } else if (id) void perform({ type: 'crane-pick', id });
        else notify('Tap one of the roof modules marked ROOF · CRANE.');
      } else if (crane.phase === 'ready') {
        if (touching) setPending({ x, z });
        else
          void perform({
            type: 'crane-place',
            ...(crane?.origin.supply ? { paint } : {}),
            level: buildLevel,
            x,
            z,
            rotation,
          });
      }
      return;
    }
    if (paintActive) {
      const piece = state?.world.pieces.find((p) => p.id === id);
      if (!piece) {
        notify('Tap a placed wall, tile, roof or furnishing to paint it.');
        return;
      }
      if (touching) {
        scene.current?.cancelWork();
        setPending({
          x: piece.x,
          z: piece.z,
          id: piece.id,
          level: piece.level,
        });
        return;
      }
      const targetFinish = finishesFor(piece.kind).some((f) => f.id === finish)
        ? finish
        : piece.finish || 'classic';
      workAt(
        {
          type: 'paint',
          id: piece.id,
          paint,
          finish: targetFinish,
          wholeHouse,
        },
        piece,
        wholeHouse ? 'To repaint the house' : 'To paint the part',
        piece.id,
      );
      return;
    }
    if (touching && (buildOpen || demolish)) {
      if (demolish && !id) {
        notify('Tap the part you want to remove.');
        return;
      }
      setPending({ x, z, id, level: buildLevel });
      setCatalogOpen(false);
      if (scene.current) {
        scene.current.cancelWork();
        scene.current.aim = { x, z, level: buildLevel };
      }
      return;
    }
    if (demolish) {
      const piece = state?.world.pieces.find((p) => p.id === id);
      if (piece)
        workAt({ type: 'remove', id }, piece, 'To removal location', id);
      else notify('Click the part you want to remove.');
    } else if (buildOpen)
      workAt(
        {
          type: 'build',
          ...selectedAppearance,
          level: buildLevel,
          kind: selected,
          x,
          z,
          rotation,
        },
        { x, z },
        'To build location',
      );
    else if (id) {
      const piece = state?.world.pieces.find((p) => p.id === id);
      if (!piece) return;
      if (touching) {
        scene.current?.cancelWork();
        setActionFeedback('');
        return;
      }
      if (held) {
        notify(
          'You are already carrying something. Put it down or throw it to free your hands.',
        );
        return;
      }
      workAt(
        { type: 'grab', id },
        piece,
        `${CATALOG.find((i) => i.id === piece.kind)?.name} · Fetch`,
        id,
      );
    }
  };
  async function start(join = false) {
    if (busy) return;
    setBusy(true);
    setError('');
    audio.current?.unlock();
    try {
      const result = await requestRoom({
        op: join ? 'join' : 'create',
        name: name.trim() || 'Apprentice',
        color,
        mode,
        map,
        code,
        ...(!join && challenge ? { challenge: 1, ...challenge } : {}),
        ...(!join && sharedBuild
          ? { buildId: sharedBuild.id, buildMode: sharedBuild.mode }
          : {}),
      });
      enter(result.session, result.snapshot);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resume() {
    if (!resumeSession) return;
    setBusy(true);
    audio.current?.unlock();
    try {
      const result = await requestRoom({ op: 'sync', ...resumeSession });
      enter(resumeSession, result.snapshot);
    } catch (error) {
      setError((error as Error).message);
      setResumeSession(null);
    } finally {
      setBusy(false);
    }
  }

  async function confirmPlacement() {
    const target =
      compact && buildOpen && !craneMode
        ? scene.current?.aim
          ? { ...scene.current.aim, id: pending?.id }
          : pending
        : pending;
    if (
      !target ||
      paintActive ||
      finished ||
      state?.world.party?.phase === 'lobby'
    )
      return;
    const issue =
      state && buildOpen
        ? placementError(state.world, selected, target, undefined, rotation)
        : placementIssue;
    if (issue) {
      notify(issue);
      return;
    }
    const piece = demolish
      ? state?.world.pieces.find((p) => p.id === target.id)
      : null;
    workAt(
      demolish
        ? { type: 'remove', id: target.id }
        : {
            type: 'build',
            ...selectedAppearance,
            level: buildLevel,
            kind: selected,
            x: target.x,
            z: target.z,
            rotation,
          },
      piece || target,
      demolish ? 'To removal location' : 'To build location',
      piece?.id,
      () => {
        setPending(null);
        scene.current?.resetTouchBuild();
      },
    );
  }
  function cancelTouchTool() {
    scene.current?.cancelWork();
    setActionFeedback('');
    if (pending) {
      setPending(null);
      scene.current?.resetTouchBuild();
    } else {
      setBuildOpen(false);
      setPainting(false);
      setDemolish(false);
      setCatalogOpen(false);
      if (scene.current) scene.current.targetId = null;
    }
  }
  function runMobileAction(action: MobileAction) {
    if (action.disabled || modalOpen || finished || mobileCrewRole) return;
    if (action.type === 'stop') {
      scene.current?.cancelWork();
      return;
    }
    if (action.type === 'cancel') {
      cancelTouchTool();
      return;
    }
    if (connectionStatus !== 'online' || actionBusy.current) return;
    if (action.type === 'rotate') {
      setRotation((v) => (v + 1) % 4);
      return;
    }
    if (action.type === 'place' || action.type === 'remove') {
      void confirmPlacement();
      return;
    }
    if (action.type === 'paint' && selectedPiece) {
      const part = selectedPiece;
      workAt(
        {
          type: 'paint',
          id: part.id,
          paint,
          wholeHouse,
          finish: finishesFor(part.kind).some((f) => f.id === finish)
            ? finish
            : part.finish || 'classic',
        },
        part,
        'To paint the part',
        part.id,
        () => setPending(null),
      );
      return;
    }
    const live = scene.current;
    const snapshot = stateRef.current;
    if (!live?.local || !snapshot) return;
    if (action.type === 'drop' || action.type === 'throw') {
      const carried = snapshot.world.pieces.find(
        (p) => p.heldBy === live.local?.id,
      );
      if (carried?.id === action.targetId) void perform({ type: action.type });
      return;
    }
    if (action.type === 'grab' || action.type === 'use') {
      if (
        live.interactionTarget()?.id !== action.targetId ||
        snapshot.world.pieces.some((p) => p.heldBy === live.local?.id)
      )
        return;
      const part = snapshot.world.pieces.find((p) => p.id === action.targetId);
      const target = describeTarget(snapshot, live.local, part);
      const issue =
        action.type === 'grab' ? target?.grabError : target?.useError;
      if (!part || !target || issue) {
        if (issue) notify(issue);
        return;
      }
      workAt(
        { type: action.type, id: part.id },
        part,
        `Walking to ${target.name.toLowerCase()}…`,
        part.id,
      );
    }
  }
  function closeBuildCatalog() {
    setCatalogOpen(false);
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(
          '.active-part-choice, .build-selection > button, .paint-selection button',
        )
        ?.focus({ preventScroll: true });
    });
  }
  function chooseBuildPart(kind: ItemKind) {
    if (held) {
      notify('Put it down or throw it first. Building needs free hands.');
      return;
    }
    setSelected(kind);
    setBuildOpen(true);
    setDemolish(false);
    setPainting(false);
    setPending(null);
    scene.current?.cancelWork();
    closeBuildCatalog();
  }
  function toggleBuild() {
    if (held) {
      notify('Put it down or throw it first. Building needs free hands.');
      return;
    }
    setCatalogOpen(buildOpen ? !catalogOpen : true);
    setBuildOpen(true);
    setDemolish(false);
    setPainting(false);
  }
  useEffect(() => {
    if (!compact || (!mobilePanel && !contractOpen)) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobilePanel(null);
        setContractOpen(false);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [compact, mobilePanel, contractOpen]);
  const mobileCrewRole =
    compact &&
    !!session &&
    !!state?.world.party &&
    state.world.party.task.roles.includes(session.id) &&
    state.world.party.task.phase !== 'done';
  const modalOpen =
    (compact && !!mobilePanel) ||
    (compact && buildOpen && catalogOpen) ||
    projectsOpen ||
    help ||
    settings ||
    invite ||
    !!resetMode ||
    (!state?.world.party && finished && !dismissedResult) ||
    (compact && contractOpen);
  const showInteraction = !modalOpen && !buildOpen && !demolish && !craneMode;
  const showBuildStatus =
    !modalOpen && buildOpen && !paintActive && !catalogOpen;
  const previewLevel = buildPreview?.level ?? buildLevel;
  const buildFloorLabel = previewLevel
    ? `Floor ${previewLevel + 1}`
    : 'Ground floor';
  const buildMessage =
    workLabel ||
    buildPreview?.error ||
    (buildPreview
      ? buildPreview.reachable
        ? compact
          ? 'Drag the grip · Choose Place'
          : 'Fits here · Click to build'
        : 'Fits here · Your builder will walk over'
      : 'Tap a spot to preview. Choose Place to walk over and build.');
  const partyPhase = state?.world.party?.phase;
  useEffect(() => {
    scene.current?.setPaused(
      modalOpen ||
        connectionStatus !== 'online' ||
        (!!partyPhase &&
          ['lobby', 'inspection', 'results'].includes(partyPhase)),
    );
  }, [modalOpen, ready, partyPhase, connectionStatus]);
  useEffect(() => {
    scene.current?.clearInput();
    if (mobileCrewRole) {
      setBuildOpen(false);
      setDemolish(false);
      setPainting(false);
      setPending(null);
    }
  }, [mobileCrewRole]);
  const tool = paintActive
    ? 'paint'
    : buildOpen
      ? 'build'
      : demolish
        ? 'remove'
        : 'walk';
  const editLocked =
    !!state?.world.party?.swap && state.world.party.swap.stage !== 'design';
  const toolIssue =
    tool !== 'walk' && editLocked
      ? 'Building is locked during the delivery.'
      : pending?.id && !selectedPiece
        ? 'This part is no longer here. Select another part.'
        : demolish && selectedPiece && state
          ? selectedPiece.heldBy ||
            selectedPiece.hoisted ||
            selectedPiece.supply
            ? 'This part is in use.'
            : removalSupportError(state.world, selectedPiece, state.players)
          : paintActive && selectedPiece
            ? !selectedPiece.placed ||
              selectedPiece.heldBy ||
              selectedPiece.hoisted
              ? 'Choose an available, placed part.'
              : wholeHouse &&
                  (!['wall', 'window', 'door'].includes(selectedPiece.kind) ||
                    !state ||
                    !onFoundation(selectedPiece, state.world.map))
                ? 'Select a house wall, window or door.'
                : wholeHouse && state?.world.party?.swap
                  ? 'Paint individual parts during Build & Swap.'
                  : null
            : buildPreview?.error || placementIssue;
  const mobileCommands = mobileActions({
    context: `${session?.code}:${state?.world.round}:${partyPhase || 'free'}:${mobileCrewRole}:${selected}:${rotation}:${paint}:${finish}:${wholeHouse}`,
    tool,
    target: interaction,
    held,
    dropError: dropIssue,
    placementKey: pending
      ? `${pending.id || ''}:${pending.x}:${pending.z}:${pending.level || 0}`
      : undefined,
    placementError: toolIssue,
    paintLabel: wholeHouse ? `Paint ${paintScope.length} walls` : 'Paint',
    working: !!workLabel,
    blocked:
      actionPending ||
      connectionStatus !== 'online' ||
      finished ||
      partyPhase === 'lobby',
  });
  const mobileTitle = held
    ? `${heldName} · carrying`
    : tool !== 'walk'
      ? paintActive || demolish
        ? selectedPiece
          ? CATALOG.find((p) => p.id === selectedPiece.kind)?.name ||
            'Selected part'
          : paintActive
            ? 'Paint existing parts'
            : 'Remove parts'
        : CATALOG.find((p) => p.id === selected)?.name || 'Build'
      : interaction?.name || 'Your next move';
  const mobileIssue =
    connectionStatus !== 'online'
      ? 'Reconnecting… Actions resume when the site is online.'
      : actionFeedback ||
        (held
          ? dropIssue
          : tool !== 'walk'
            ? toolIssue
            : interaction?.grabError);
  const mobileMessage =
    mobileIssue ||
    (actionPending
      ? 'Working…'
      : workLabel ||
        (held
          ? 'Tap ground to aim. Put down secures it; Throw releases it.'
          : tool === 'build'
            ? pending
              ? 'Drag the grip to adjust. Place builds it.'
              : 'Tap a spot, then choose Place.'
            : tool === 'paint'
              ? pending
                ? `${paintScope.length} part${paintScope.length === 1 ? '' : 's'} selected · Paint to apply.`
                : 'Select a placed part to preview the color.'
              : tool === 'remove'
                ? 'Select a part, then choose Remove.'
                : interaction
                  ? interaction.useLabel
                    ? `${interaction.reachable ? 'Within reach' : 'Fetch walks over'} · Use: ${interaction.useLabel}`
                    : interaction.reachable
                      ? 'Pick up the highlighted part.'
                      : 'Fetch walks over and picks up this part.'
                  : 'Select an object, then Pick up. Drag left to walk.'));

  return (
    <main
      className={`game-shell ${session ? 'is-playing' : ''} ${firstPerson && !craneMode ? 'first-person-view' : ''} ${compact ? 'compact-ui touch-layout' : ''} ${craneMode ? 'crane-active' : ''} ${buildOpen && catalogOpen ? 'build-open' : ''} ${buildOpen && !catalogOpen ? 'build-collapsed' : ''} ${pending ? 'has-placement' : ''} ${mobileCrewRole ? 'mobile-carrying' : ''} ${compact && modalOpen ? 'mobile-panel-open' : ''}`}
    >
      <div ref={mount} className="world-canvas" />
      <div className="world-vignette" />
      {session && state?.world.party && connection.current && scene.current && (
        <PartyPanel
          key={session.id}
          snapshot={state}
          voiceRequest={voiceRequest}
          compact={compact}
          mobilePanel={mobilePanel}
          onMobilePanel={openMobilePanel}
          broadcast={broadcast}
          session={session}
          connection={connection.current}
          scene={scene.current}
          audio={audio.current}
          notify={notify}
          inputBlocked={modalOpen || connectionStatus !== 'online'}
          invite={() => setInvite(true)}
          checklist={() => {
            setMobilePanel(null);
            setContractOpen(true);
          }}
        />
      )}
      {session && firstPerson && !craneMode && !modalOpen && (
        <div className="eye-crosshair" aria-hidden="true">
          +
        </div>
      )}
      <header className="topbar">
        <a href="/" className="wordmark" aria-label="Permit Pending home">
          <span className="logo-icon">
            <HardHat size={28} strokeWidth={2.5} />
          </span>
          <span>
            PERMIT PENDING<span className="logo-dot">.</span>
          </span>
        </a>
        {session && state ? (
          <div className="crew-bar">
            {state.players.map((p) => (
              <span key={p.id} className="crew-member">
                <span style={{ background: PLAYER_COLORS[p.color] }}>
                  <HardHat size={17} />
                </span>
                <b>{p.name}</b>
                {p.id === state.host && <small>SITE MANAGER</small>}
              </span>
            ))}
            {Array.from({ length: 4 - state.players.length }, (_, i) => (
              <button
                key={i}
                className="empty-player"
                aria-label="Invite friends"
                onClick={() => setInvite(true)}
              >
                <Plus size={17} />
              </button>
            ))}
          </div>
        ) : (
          <div className="topbar-center">
            <span className="status-dot" /> BROWSER OPEN. HARD HAT ON.
          </div>
        )}
        <div className="topbar-actions">
          {compact && session && state && (
            <button
              className="mobile-crew-count"
              aria-label={`Crew: ${state.players.length} of 4. Invite friends`}
              onClick={() =>
                broadcast
                  ? notify(
                      'Turn off broadcast mode in settings to reveal the invite.',
                    )
                  : setInvite(true)
              }
            >
              <Users size={18} />
              {state.players.length}/4
            </button>
          )}
          <GameToolbar
            workshop="/chaos/admin"
            onVoice={
              session && state?.world.party
                ? () => {
                    setVoiceRequest((value) => value + 1);
                    if (compact) openMobilePanel('social');
                  }
                : undefined
            }
            voiceHint="Voice chat is available in Crew Jobs. Create or join a Crew Jobs room to talk with friends."
            muted={!sound}
            onToggleSound={() => setSound((value) => !value)}
            onHelp={() => setHelp(true)}
            onLeave={
              session
                ? () => void leave().then(() => location.assign('/'))
                : undefined
            }
          />
          <button
            className="icon-button"
            aria-label="Settings"
            onClick={() => setSettings(true)}
          >
            <Settings2 size={19} />
          </button>
        </div>
      </header>
      {!session && (
        <>
          <section className="start-panel">
            <div className="eyebrow">
              <span className="tiny-line" /> YOUR CREW. YOUR BUILDING SITE.
            </div>
            {sharedBuild && (
              <p>
                Opening a saved build ·{' '}
                {sharedBuild.mode === 'try'
                  ? 'Try the delivery'
                  : sharedBuild.mode === 'remix'
                    ? 'Make your own remix'
                    : 'Explore with your crew'}
              </p>
            )}
            {challenge && (
              <p role="status">
                <b>Challenge invitation:</b>{' '}
                {CREW_JOBS.find((j) => j.id === challenge.job)?.name}. Start
                below to open a fresh site for your crew.
              </p>
            )}
            <h1>
              Together,
              <br />
              we build{' '}
              <span>
                chaos
                <svg viewBox="0 0 200 12" aria-hidden="true">
                  <path d="M3 8 Q90 0 195 5" />
                </svg>
                .
              </span>
            </h1>
            <p className="intro">
              Build a house. Throw a sofa. Claim it was intentional.
            </p>
            <div className="player-pills">
              <span>
                <Users size={15} /> 1–4 people
              </span>
              <span>
                <span className="green-dot" /> Play in your browser
              </span>
            </div>
            <div className="setup-card">
              <label className="field-label" htmlFor="player-name">
                WHO IS ON THE CREW?
              </label>
              <div className="name-field">
                <HardHat size={20} />
                <input
                  id="player-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={18}
                  placeholder="Your builder name"
                  autoComplete="nickname"
                />
              </div>
              <div className="color-row">
                <span>Your hard hat</span>
                <div
                  className="color-options"
                  role="group"
                  aria-label="Hard hat color"
                >
                  {PLAYER_COLORS.map((c, i) => (
                    <button
                      key={c}
                      aria-label={
                        [
                          'Yellow hard hat',
                          'Turquoise hard hat',
                          'Pink hard hat',
                          'Purple hard hat',
                        ][i]
                      }
                      aria-pressed={color === i}
                      className={`color-dot ${color === i ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setColor(i)}
                    >
                      {color === i && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </div>
              <Tabs
                value={mode}
                onValueChange={(v) => setMode(v as Mode)}
                className="mode-tabs"
              >
                <TabsList className="mode-list">
                  <TabsTrigger className="mode-trigger" value="job">
                    <Timer size={16} /> Chaos job
                  </TabsTrigger>
                  <TabsTrigger className="mode-trigger" value="sandbox">
                    <Hammer size={16} /> Free building
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="job" className="mode-description">
                  4 minutes. One customer request. Plenty of excuses.
                </TabsContent>
                <TabsContent value="sandbox" className="mode-description">
                  Your plot. Your ideas. No time pressure.
                </TabsContent>
              </Tabs>
              {!joining && (
                <fieldset className="map-picker">
                  <legend>CHOOSE YOUR MAP</legend>
                  <div>
                    {MAPS.map((option) => (
                      <button
                        type="button"
                        key={option.id}
                        aria-pressed={map === option.id}
                        aria-label={`${option.name}: ${option.description}`}
                        onClick={() => setMap(option.id)}
                      >
                        <strong>
                          {option.name}
                          {map === option.id && <Check size={15} />}
                        </strong>
                      </button>
                    ))}
                  </div>
                  <p className="map-description" aria-live="polite">
                    {mapConfig(map).description}
                  </p>
                </fieldset>
              )}
              {joining && (
                <p className="mode-description">
                  Joining uses the host’s map and game mode.
                </p>
              )}
              <button
                className="primary-button start-button"
                onClick={() => void start()}
                disabled={!ready || busy}
              >
                <span>
                  {busy ? 'Handing out hard hats …' : 'Open a building site'}
                </span>
                <ArrowRight size={21} />
              </button>
              {resumeSession && (
                <button
                  className="join-toggle"
                  disabled={!ready || busy}
                  onClick={() => void resume()}
                >
                  Back to the building site {resumeSession.code}
                  <ArrowRight size={15} />
                </button>
              )}
              <button
                className="join-toggle"
                onClick={() => setJoining(!joining)}
              >
                <Users size={16} /> Join your friends <ArrowUpRight size={15} />
              </button>
              {joining && (
                <form
                  className="join-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void start(true);
                  }}
                >
                  <input
                    aria-label="Room code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    placeholder="ROOM CODE"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    autoCapitalize="characters"
                    enterKeyHint="go"
                  />
                  <button
                    aria-label="Join room"
                    disabled={busy || !ready || code.length !== 6}
                  >
                    <ArrowRight size={20} />
                  </button>
                </form>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="start-links">
              <BuildShelf notify={notify} />
              <button className="how-link" onClick={() => setHelp(true)}>
                <BookOpen size={15} /> How to play
              </button>
            </div>
          </section>
          <div className="scene-stamp">
            <span className="stamp-icon">
              <Construction size={21} />
            </span>
            <div>
              <strong>DEVELOPMENT: CROOKED CORNER</strong>
              <span>Plot 04 · Plenty of potential.</span>
            </div>
          </div>
          <div className="scene-note">
            <span className="note-pin" />
            NO QUALIFICATIONS.
            <br />
            NO PROBLEM.
            <span className="note-small">What could possibly go wrong?</span>
          </div>
          <footer className="start-footer">
            <span>100% teamwork. More or less.</span>
            <span>
              <MousePointer2 size={13} /> Drag with the right mouse button to
              look around <span className="footer-divider">/</span> Scroll to
              zoom
            </span>
            <button
              onClick={() => {
                document.documentElement.requestFullscreen?.().catch(() => {});
              }}
              aria-label="Fullscreen"
            >
              <Maximize size={16} />
            </button>
          </footer>
        </>
      )}
      {session && state && progress && (
        <>
          <button
            className="mobile-contract"
            aria-expanded={contractOpen}
            aria-controls="job-details"
            onClick={() => setContractOpen((v) => !v)}
          >
            <span>
              <Hammer size={16} />
              {state.world.mode === 'job' ? progress.job.name : 'Free building'}
            </span>
            <strong>
              {state.world.mode === 'job'
                ? `${progress.done}/${progress.total} · ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
                : `${state.world.pieces.length} Parts`}
            </strong>
            <ChevronDown size={17} />
          </button>
          <aside
            id="job-details"
            className={`contract-panel ${contractOpen ? 'expanded' : ''}`}
          >
            <button
              className="mobile-contract-close"
              onClick={() => setContractOpen(false)}
              aria-label="Close job"
            >
              <X size={18} />
            </button>
            <div className="contract-heading">
              <span>
                <span className="green-dot" />
                {state.world.mode === 'job' ? 'CUSTOMER JOB' : 'FREE BUILDING'}
              </span>
              <span>#{String(state.world.round + 1).padStart(2, '0')}</span>
            </div>
            <h2>
              {state.world.mode === 'job'
                ? progress.job.name
                : 'Room for your ideas.'}
            </h2>
            {state.world.mode === 'job' ? (
              <>
                <div className="customer-quote">
                  <div className="customer-avatar">
                    <HardHat size={22} />
                  </div>
                  <div>
                    <strong>{progress.job.client}</strong>
                    <p>{progress.job.quote}</p>
                  </div>
                </div>
                <div className={`timer-bar ${remaining < 40 ? 'urgent' : ''}`}>
                  <Timer size={19} />
                  <span>Inspection in</span>
                  <strong>
                    {Math.floor(remaining / 60)}:
                    {String(remaining % 60).padStart(2, '0')}
                  </strong>
                </div>
                <div className="progress-label">
                  <span>What the plot needs</span>
                  <b>
                    {progress.done}/{progress.total}
                  </b>
                </div>
                <Progress
                  value={progress.ratio * 100}
                  className="job-progress"
                />
                <div className="job-checklist">
                  {Object.entries(progress.job.needs).map(
                    ([kind, required]) => {
                      const item = CATALOG.find((i) => i.id === kind)!;
                      const done = progress.counts[item.id] || 0;
                      return (
                        <button
                          key={kind}
                          className={`job-item ${done >= required ? 'done' : ''}`}
                          onClick={() => {
                            setCategory(item.category);
                            setSelected(item.id);
                            setBuildOpen(true);
                            setDemolish(false);
                            setContractOpen(false);
                          }}
                        >
                          <span className="check-box">
                            {done >= required ? <Check size={12} /> : null}
                          </span>
                          <span>{item.name}</span>
                          <b>
                            {Math.min(done, required)}/{required}
                          </b>
                        </button>
                      );
                    },
                  )}
                </div>
                <p className="contract-tip">
                  Only fixed parts on the light building area count. Walls
                  first, then the roof.
                </p>
              </>
            ) : (
              <>
                <p className="sandbox-copy">
                  Build your dream house, try the new furniture, and earn six
                  home-project badges.
                </p>
                <button
                  className="secondary-button"
                  onClick={() => setProjectsOpen(true)}
                >
                  <Trophy size={16} />
                  Home projects
                  <ArrowRight size={16} />
                </button>
                <div className="sandbox-stats">
                  <span>
                    <b>{state.world.pieces.length}</b>Building parts
                  </span>
                  <span>
                    <b>{state.world.throws}</b>Flight lessons
                  </span>
                  <span>
                    <b>{state.world.bonks}</b>Workplace mishaps
                  </span>
                </div>
                <div className="sandbox-tips">
                  <p>
                    <Hammer size={15} /> Build, carry and throw furniture and
                    site materials.
                  </p>
                  <p>
                    <Hand size={15} /> Pick up and move objects with E.
                  </p>
                  <p>
                    <Send size={15} /> F throws, E puts it down.
                  </p>
                </div>
                {isHost && (
                  <button
                    className="secondary-button"
                    onClick={() => setResetMode('job')}
                  >
                    Ready for a job?
                    <ArrowRight size={16} />
                  </button>
                )}
              </>
            )}
            <div className="contract-footer">
              <span>CROOKED CORNER BUILDING OFFICE</span>
              <span>✓ No guarantees</span>
            </div>
          </aside>
          {compact && (
            <div className="room-panel">
              <button
                className="room-code-button"
                onClick={() =>
                  broadcast
                    ? notify(
                        'Turn off broadcast mode in settings to reveal the invite.',
                      )
                    : setInvite(true)
                }
              >
                <div>
                  <span>
                    {mapConfig(state.world.map).name.toUpperCase()} BUILDING
                    SITE
                  </span>
                  <strong>{broadcast ? 'ON AIR' : session.code}</strong>
                </div>
                <Users size={21} />
                <span className="room-count">{state.players.length}/4</span>
              </button>
              <div
                className={`network-status ${connectionStatus === 'online' ? '' : 'offline'}`}
              >
                <span className="green-dot" />
                {connectionStatus === 'online'
                  ? 'Everyone on the same site'
                  : connectionStatus === 'expired'
                    ? 'Please rejoin'
                    : 'Reconnecting …'}
              </div>
            </div>
          )}
          {!finished &&
            latestWind <= 8 &&
            !showInteraction &&
            !showBuildStatus && (
              <div className="wind-warning">
                <Wind size={21} />
                <div>
                  <strong>The wind is picking up!</strong>
                  <span>Secure loose furniture · {latestWind}s</span>
                </div>
              </div>
            )}
          {compact && (
            <div className="play-side-tools">
              <button
                className={`icon-button ${firstPerson ? 'active' : ''}`}
                aria-label={
                  firstPerson
                    ? 'Switch to overhead view'
                    : 'Switch to first-person view'
                }
                aria-pressed={firstPerson}
                disabled={craneMode}
                title="Switch view · V"
                onClick={toggleView}
              >
                <Eye size={20} />
                <span className="crane-tool-label">
                  {firstPerson ? 'Overhead' : '1st person'}
                </span>
              </button>
              <button
                className={`icon-button ${craneMode ? 'active' : ''}`}
                aria-label="Use roof crane"
                title="Roof crane · C"
                aria-pressed={craneMode}
                onClick={() => actions.current('crane')}
              >
                <Construction size={20} />
                <span className="crane-tool-label">Crane</span>
              </button>
              <button
                className="icon-button"
                aria-label="Save site photo"
                onClick={() => {
                  audio.current?.play('event.photo');
                  scene.current?.photo();
                  notify('Your masterpiece will be saved as an image.');
                }}
              >
                <Camera size={20} />
              </button>
              <button
                className="icon-button"
                aria-label="How to play"
                onClick={() => setHelp(true)}
              >
                <BookOpen size={20} />
              </button>
              <button
                className="icon-button"
                aria-label="Fullscreen"
                onClick={() =>
                  document.documentElement.requestFullscreen?.().catch(() => {})
                }
              >
                <Maximize size={20} />
              </button>
            </div>
          )}
          <button
            className="mobile-view-toggle"
            aria-label="Camera controls"
            aria-haspopup="dialog"
            onClick={() => openMobilePanel('camera')}
          >
            <Eye size={20} />
          </button>
          <div className="mobile-camera" aria-label="Camera">
            <button
              aria-label="Rotate camera left"
              onClick={() => scene.current?.cameraAction('left')}
            >
              <RotateCcw size={18} />
            </button>
            <button
              aria-label="Rotate camera right"
              onClick={() => scene.current?.cameraAction('right')}
            >
              <RotateCw size={18} />
            </button>
            <button
              aria-label={firstPerson && !craneMode ? 'Look up' : 'Zoom in'}
              onClick={() => scene.current?.cameraAction('in')}
            >
              <Plus size={19} />
            </button>
            <button
              aria-label={firstPerson && !craneMode ? 'Look down' : 'Zoom out'}
              onClick={() => scene.current?.cameraAction('out')}
            >
              <Minus size={19} />
            </button>
            <button
              aria-label="Reset camera"
              onClick={() => scene.current?.cameraAction('reset')}
            >
              <Scan size={18} />
            </button>
          </div>
          <div
            className="play-bottom"
            role="toolbar"
            tabIndex={-1}
            aria-label="Construction controls"
            onKeyDown={(event) => {
              const target = event.target as HTMLElement;
              if (
                target.closest('select, input, textarea') ||
                (target.closest('button, [role="tab"]') &&
                  [
                    'Enter',
                    ' ',
                    'ArrowUp',
                    'ArrowDown',
                    'ArrowLeft',
                    'ArrowRight',
                  ].includes(event.key))
              ) {
                event.stopPropagation();
              }
            }}
          >
            {!compact && (
              <div className="room-panel">
                <button
                  className="room-code-button"
                  onClick={() =>
                    broadcast
                      ? notify(
                          'Turn off broadcast mode in settings to reveal the invite.',
                        )
                      : setInvite(true)
                  }
                >
                  <div>
                    <span>
                      {mapConfig(state.world.map).name.toUpperCase()} BUILDING
                      SITE
                    </span>
                    <strong>{broadcast ? 'ON AIR' : session.code}</strong>
                  </div>
                  <Users size={21} />
                  <span className="room-count">{state.players.length}/4</span>
                </button>
                <div
                  className={`network-status ${connectionStatus === 'online' ? '' : 'offline'}`}
                >
                  <span className="green-dot" />
                  {connectionStatus === 'online'
                    ? 'Everyone on the same site'
                    : connectionStatus === 'expired'
                      ? 'Please rejoin'
                      : 'Reconnecting …'}
                </div>
              </div>
            )}
            {!compact && buildOpen && !catalogOpen && !paintActive && (
              <ActiveBuildPart
                name={
                  CATALOG.find((i) => i.id === selected)?.name ||
                  'Building part'
                }
                thumbnail={thumbnails[selected]}
                floor={buildFloorLabel}
                rotation={rotation}
                error={!!buildPreview?.error}
                message={
                  (buildPreview?.snapped
                    ? buildPreview.join === 'corner'
                      ? 'Corner snapped · '
                      : 'Edge snapped · '
                    : '') +
                  buildMessage +
                  (!finished && latestWind <= 8
                    ? ' · Wind in ' + latestWind + 's'
                    : '')
                }
                onChoose={() => setCatalogOpen(true)}
                onRotate={() => setRotation((v) => (v + 1) % 4)}
              />
            )}

            {(buildOpen || craneMode) && (
              <div className="floor-picker">
                <label htmlFor="building-floor">Build on</label>
                <select
                  id="building-floor"
                  value={buildLevel}
                  onChange={(e) => {
                    setBuildLevel(Number(e.target.value));
                    setPending(null);
                    scene.current?.cancelWork();
                  }}
                >
                  <option value="0">Floor 1 · ground</option>
                  <option value="1">Floor 2</option>
                  <option value="2">Floor 3</option>
                </select>
                <span>
                  {buildLevel
                    ? 'Lay tiles, leave a stairwell'
                    : 'Stairs connect the floors'}
                </span>
              </div>
            )}
            {craneMode && (
              <CraneControls
                crane={crane}
                own={ownCrane}
                target={!!(pending || buildPreview)}
                error={buildPreview?.error}
                rotation={rotation}
                onPlace={placeRoof}
                onRotate={() => setRotation((v) => (v + 1) % 4)}
                onClose={() => void closeCrane()}
                selectedRoof={compact ? selectedRoof : null}
                onLift={
                  compact
                    ? () => {
                        if (selectedRoof)
                          void perform({
                            type: 'crane-pick',
                            id: selectedRoof,
                          });
                      }
                    : undefined
                }
                actionKey={`${crane?.phase}:${pending?.x}:${pending?.z}:${buildLevel}:${rotation}`}
                blocked={actionPending || connectionStatus !== 'online'}
              />
            )}
            {compact && buildOpen && !catalogOpen && !paintActive && (
              <div
                className={`build-selection ${buildPreview?.error ? 'blocked' : buildPreview?.reachable ? 'ready' : 'approach'}`}
              >
                <button onClick={() => setCatalogOpen(true)}>
                  <Hammer size={17} />
                  {CATALOG.find((i) => i.id === selected)?.name}
                  {selected === 'floor' ? ` · ${buildFloorLabel}` : ''}
                  {buildPreview
                    ? ` · ${buildPreview.x}, ${buildPreview.z}`
                    : ''}
                  <ChevronDown size={16} />
                </button>
                <button
                  onClick={cancelTouchTool}
                  aria-label={pending ? 'Cancel placement' : 'Leave building'}
                >
                  <X size={18} />
                  {pending ? 'Cancel' : 'Done'}
                </button>
                <span className="build-feedback" role="status">
                  {buildPreview?.snapped
                    ? `${buildPreview.join === 'corner' ? 'Corner snapped' : 'Edge snapped'} · `
                    : ''}
                  {buildMessage}
                  {!finished && latestWind <= 8
                    ? ` · Wind in ${latestWind}s`
                    : ''}
                </span>
              </div>
            )}
            {paintActive && !catalogOpen && (
              <div className="paint-selection">
                <span>
                  {wholeHouse
                    ? 'Paint the exterior · tap a house wall'
                    : 'Paintbrush ready · tap a placed part'}
                </span>
                <button onClick={() => setCatalogOpen(true)}>Colors</button>
                <button
                  onClick={() => {
                    setPainting(false);
                    setBuildOpen(false);
                  }}
                >
                  Done
                </button>
              </div>
            )}
            {buildOpen && catalogOpen && (
              <BuildKit
                count={state.world.pieces.length}
                category={category}
                selected={selected}
                thumbnails={thumbnails}
                rotation={rotation}
                paint={paint}
                finish={finish}
                painting={paintActive}
                wholeHouse={wholeHouse}
                onCategory={(v) => {
                  setCategory(v);
                  const first = CATALOG.find((i) => i.category === v);
                  if (first) setSelected(first.id);
                }}
                onSelect={chooseBuildPart}
                onClose={closeBuildCatalog}
                onReady={closeBuildCatalog}
                onRotate={() => setRotation((v) => (v + 1) % 4)}
                onPaint={setPaint}
                onFinish={setFinish}
                onPainting={() => {
                  setPainting(!painting);
                  setDemolish(false);
                  setPending(null);
                  scene.current?.cancelWork();
                }}
                onWholeHouse={setWholeHouse}
                onProjects={() => setProjectsOpen(true)}
              />
            )}
            {compact ? (
              <nav
                className="tool-dock mobile-main-dock"
                aria-label="Tools"
                inert={
                  craneMode || mobileCrewRole || (modalOpen && !catalogOpen)
                }
              >
                <button
                  className={buildOpen ? 'active' : ''}
                  disabled={!!held || !!mobileCrewRole || finished}
                  onClick={() => {
                    setMobilePanel(null);
                    setContractOpen(false);
                    toggleBuild();
                  }}
                >
                  <Hammer size={21} />
                  <span>Build</span>
                </button>
                <button onClick={() => openMobilePanel('camera')}>
                  <Eye size={21} />
                  <span>View</span>
                </button>
                <button
                  aria-label="More tools, voice and sharing"
                  aria-haspopup="dialog"
                  className={demolish ? 'active danger-tool' : ''}
                  onClick={() => openMobilePanel('tools')}
                >
                  <Plus size={21} />
                  <span>{demolish ? 'Remove' : 'More'}</span>
                </button>
              </nav>
            ) : (
              <SiteTools
                building={buildOpen}
                catalogOpen={catalogOpen}
                removing={demolish}
                crane={craneMode}
                firstPerson={firstPerson}
                sound={sound}
                holding={!!held}
                canGrab={!!(held || nearby)}
                canUse={!held && !!PROP_USES[nearby as ItemKind]}
                useLabel={PROP_USES[nearby as ItemKind]?.label || 'Use prop'}
                onWalk={() => {
                  setBuildOpen(false);
                  setCatalogOpen(false);
                  setDemolish(false);
                  setPainting(false);
                  setPending(null);
                  scene.current?.cancelWork();
                }}
                onBuild={toggleBuild}
                onRemove={() => {
                  setDemolish(!demolish);
                  setBuildOpen(false);
                  setPending(null);
                  scene.current?.cancelWork();
                }}
                onAction={(action) => actions.current(action)}
                onView={toggleView}
                onPhoto={() => {
                  audio.current?.play('event.photo');
                  scene.current?.photo();
                  notify('Your masterpiece will be saved as an image.');
                }}
                onHelp={() => setHelp(true)}
                onSound={() => setSound(!sound)}
                onSettings={() => setSettings(true)}
              />
            )}
            <div className="context-hint">
              {paintActive
                ? 'Tap a placed part to paint it · Choose Colors to change the finish'
                : firstPerson && !craneMode
                  ? compact
                    ? 'Joystick to walk · Drag to look · Use the action buttons · View opens camera controls'
                    : 'WASD move · Mouse look · E pick up/drop · F throw · X use prop · V view · Esc frees mouse'
                  : craneMode
                    ? 'Tap roof → Lift → Tap house to place · R rotates · Esc returns load'
                    : workLabel
                      ? `${workLabel} · Walking manually cancels this`
                      : buildOpen
                        ? compact
                          ? 'Tap to preview · Drag the grip · Choose Place'
                          : 'Choose a location → Your builder walks over · Enter builds in front of you'
                        : demolish
                          ? 'Select a part → Your builder walks over and removes it'
                          : held
                            ? `Tap the ground / move the mouse to aim · ${compact ? 'Put down / Throw' : 'E put down · F throw'}`
                            : compact
                              ? 'Select an object · Choose Pick up or Fetch · Joystick to walk'
                              : 'Click an object to fetch it · WASD to walk'}
            </div>
          </div>
          {showInteraction && !compact && (
            <div
              className={`interaction-status ${held ? 'carrying' : ''}`}
              role="status"
            >
              <span className="interaction-icon">
                <Hand size={21} />
              </span>
              <div>
                <strong>
                  {workLabel ||
                    (held
                      ? `Carrying: ${heldName}`
                      : nearbyName
                        ? `${nearbyName} within reach`
                        : 'Your builder is on it')}
                </strong>
                <span>
                  {held
                    ? `${pieceShape(held.kind).mass} kg · Put down to secure · Throw to release`
                    : nearbyName
                      ? `${compact ? 'Pick up' : 'Press E'} or choose another object`
                      : 'Tap an object to walk over and pick it up'}
                </span>
                {!finished && latestWind <= 8 && (
                  <span className="interaction-wind">
                    Wind in {latestWind}s · Secure loose furniture!
                  </span>
                )}
              </div>
              {(held || nearby) && (
                <button onClick={() => actions.current('grab')}>
                  {held ? 'Put down' : 'Pick up'}
                  {!compact && <kbd>E</kbd>}
                </button>
              )}
            </div>
          )}

          {compact &&
            !modalOpen &&
            !craneMode &&
            !finished &&
            partyPhase !== 'lobby' && (
              <>
                {!mobileCrewRole && (
                  <MobileActionHud
                    primary={mobileCommands.primary}
                    secondary={mobileCommands.secondary}
                    title={mobileTitle}
                    message={mobileMessage}
                    error={!!mobileIssue}
                    canJump={!actionPending && connectionStatus === 'online'}
                    canCycle={
                      !firstPerson &&
                      !held &&
                      tool === 'walk' &&
                      (scene.current?.targetChoices.length || 0) > 1
                    }
                    onCycle={() => scene.current?.nextTarget()}
                    onAction={runMobileAction}
                    onJump={() => scene.current?.jump()}
                  />
                )}
                {!(
                  mobileCrewRole &&
                  state.world.party &&
                  (state.world.party.task.kind === 'ladder' ||
                    state.world.party.task.phase !== 'working' ||
                    (state.world.party.task.kind === 'crane' &&
                      state.world.party.task.roles[1] === session?.id &&
                      !state.world.party.task.solo))
                ) && (
                  <TouchControls
                    key={String(mobileCrewRole)}
                    showJump={false}
                    allowSprint={!mobileCrewRole}
                    onMove={(x, z, sprint) => {
                      if (scene.current) {
                        scene.current.setTouchInput(true);
                        scene.current.touch = { x, z };
                        scene.current.sprint = sprint;
                      }
                    }}
                    onJump={() => scene.current?.jump()}
                  />
                )}
              </>
            )}

          {!state?.world.party && finished && dismissedResult && (
            <button
              className="result-reopen"
              onClick={() => setDismissedResult(false)}
            >
              <Trophy size={18} /> View inspection
            </button>
          )}
        </>
      )}
      {toast && (
        <div className="game-toast" role="status">
          <HardHat size={18} />
          {toast}
        </div>
      )}
      {!ready && !error && (
        <div className="loading-badge">
          <span className="loader" /> Setting up the building site …
        </div>
      )}
      <Dialog
        open={compact && (mobilePanel === 'camera' || mobilePanel === 'tools')}
        onOpenChange={(open) => {
          if (!open) setMobilePanel(null);
        }}
      >
        <DialogContent className="game-dialog mobile-options-dialog">
          <DialogTitle className="dialog-heading">
            {mobilePanel === 'camera' ? 'Your view' : 'Tools & crew'}
          </DialogTitle>
          <DialogDescription>
            {mobilePanel === 'camera'
              ? 'Drag the site to look around. Pinch with two fingers to zoom.'
              : 'Choose an action, then get back to the site.'}
          </DialogDescription>
          <div className="mobile-options-grid">
            {mobilePanel === 'camera' ? (
              <>
                <button
                  className="secondary-button"
                  disabled={craneMode}
                  onClick={() => {
                    toggleView();
                    setMobilePanel(null);
                  }}
                >
                  <Eye size={20} />
                  {firstPerson ? 'Overhead view' : 'First-person view'}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => scene.current?.cameraAction('reset')}
                >
                  <Scan size={20} />
                  Reset view
                </button>
                <button
                  className="secondary-button"
                  onClick={() => scene.current?.cameraAction('left')}
                >
                  <RotateCcw size={20} />
                  Turn left
                </button>
                <button
                  className="secondary-button"
                  onClick={() => scene.current?.cameraAction('right')}
                >
                  <RotateCw size={20} />
                  Turn right
                </button>
                <button
                  className="secondary-button"
                  onClick={() => scene.current?.cameraAction('in')}
                >
                  <Plus size={20} />
                  {firstPerson ? 'Look up' : 'Zoom in'}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => scene.current?.cameraAction('out')}
                >
                  <Minus size={20} />
                  {firstPerson ? 'Look down' : 'Zoom out'}
                </button>
                {!firstPerson &&
                  (['left', 'right', 'up', 'down'] as const).map(
                    (direction) => (
                      <button
                        key={direction}
                        className="secondary-button"
                        onClick={() =>
                          scene.current?.cameraAction(`pan-${direction}`)
                        }
                      >
                        Pan {direction}
                      </button>
                    ),
                  )}
              </>
            ) : (
              <>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setMobilePanel(null);
                    setDemolish(!demolish);
                    setBuildOpen(false);
                    setPending(null);
                  }}
                >
                  <Construction size={20} />
                  {demolish ? 'Stop removing' : 'Remove parts'}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setMobilePanel(null);
                    actions.current('crane');
                  }}
                >
                  <Construction size={20} />
                  Roof crane
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setMobilePanel(null);
                    actions.current('emote');
                  }}
                >
                  <Smile size={20} />
                  Shout an excuse
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setMobilePanel(null);
                    setProjectsOpen(true);
                  }}
                >
                  <Hammer size={20} />
                  Home projects
                </button>
                <button
                  className="secondary-button"
                  onClick={() => scene.current?.photo()}
                >
                  <Camera size={20} />
                  Save photo
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setMobilePanel(null);
                    setHelp(true);
                  }}
                >
                  <BookOpen size={20} />
                  Touch controls
                </button>
                {state?.world.party && (
                  <button
                    className="secondary-button"
                    onClick={() => openMobilePanel('social')}
                  >
                    <Volume2 size={20} />
                    Voice & clips
                  </button>
                )}
                <button
                  className="secondary-button"
                  onClick={() => {
                    setMobilePanel(null);
                    setSettings(true);
                  }}
                >
                  <Settings2 size={20} />
                  Settings
                </button>
              </>
            )}
          </div>
          {mobilePanel === 'tools' && (
            <BuildShelf session={session || undefined} notify={notify} />
          )}
          <button
            className="primary-button"
            onClick={() => setMobilePanel(null)}
          >
            Back to game
            <Check size={18} />
          </button>
        </DialogContent>
      </Dialog>
      {state && (
        <HomeProjects
          world={state.world}
          open={projectsOpen}
          onOpenChange={setProjectsOpen}
          onChoose={(kind) => {
            setProjectsOpen(false);
            setSelected(kind);
            setCategory(CATALOG.find((i) => i.id === kind)!.category);
            setBuildOpen(true);
            setCatalogOpen(true);
            setPainting(false);
            setDemolish(false);
            setCraneMode(false);
          }}
        />
      )}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="game-dialog">
          <div className="dialog-icon">
            <HardHat size={30} />
          </div>
          <DialogTitle className="dialog-heading">
            Your first day on the job.
          </DialogTitle>
          <DialogDescription>
            Luckily, nobody here reads resumes.
          </DialogDescription>
          <div className="instructions">
            <p>
              <kbd>{compact ? 'View' : 'View · V'}</kbd>
              <span>
                {compact
                  ? 'Open View to switch cameras. Drag the scene to look and use the joystick to walk. Roof crane mode uses the overhead view.'
                  : 'Switch between overhead and first person in the same room. Click the site for mouse-look; Escape frees the mouse. Crane mode uses the overhead view.'}
              </span>
            </p>
            <p>
              <kbd>{compact ? 'Roof crane' : 'Crane · C'}</kbd>
              <span>
                {compact
                  ? 'Open More → Roof crane. Select a roof module, choose Lift roof and wait for the rope. Tap a spot, rotate if needed, then choose Place roof. Return roof puts an unfinished lift back.'
                  : 'Choose Roof or Crane. Click a roof module beside the house, wait for the lift, then choose a spot on the house. R rotates; Esc returns the load.'}
              </span>
            </p>
            {compact ? (
              <>
                <p>
                  <kbd>Drag</kbd>
                  <span>
                    Left joystick: walk. Push to the outer ring to sprint.
                    Release to stop.
                  </span>
                </p>
                <p>
                  <kbd>Pick up</kbd>
                  <span>
                    Tap an object to select it. Pick up grabs it within reach;
                    Fetch walks over first. Use is a separate action for props.
                  </span>
                </p>
                <p>
                  <kbd>Throw</kbd>
                  <span>
                    While carrying, tap the ground to aim. Throw releases it;
                    Put down secures it.
                  </span>
                </p>
                <p>
                  <kbd>Build</kbd>
                  <span>
                    Choose a part and tap a spot to preview it. Drag its marked
                    grip to adjust, then press Place to walk over and build.
                    Tapping elsewhere moves the preview. Two fingers control the
                    camera.
                  </span>
                </p>
                <p>
                  <kbd>Rotate</kbd>
                  <span>
                    Use Rotate beside Place. Cancel clears the preview; Done
                    leaves building.
                  </span>
                </p>
                <p>
                  <kbd>Camera</kbd>
                  <span>
                    Drag on the site. Use two fingers to zoom and pan.
                  </span>
                </p>
                <p>
                  <kbd>Jump</kbd>
                  <span>
                    Jump is above your action buttons. Open More to shout an
                    excuse, take photos or save a build.
                  </span>
                </p>
              </>
            ) : (
              <>
                <p>
                  <kbd>W A S D</kbd>
                  <span>
                    Walk · <b>Shift</b> to sprint
                  </span>
                </p>
                <p>
                  <kbd>E</kbd>
                  <span>
                    Pick up the highlighted part or secure it in front of you.
                    Click an object to fetch it.
                  </span>
                </p>
                <p>
                  <kbd>F</kbd>
                  <span>
                    Throw. Aim with the mouse, or tap the ground on mobile.
                  </span>
                </p>
                <p>
                  <kbd>B</kbd>
                  <span>
                    Open the building kit, choose a part, click a location: your
                    builder walks over. Enter builds in front of you.
                  </span>
                </p>
                <p>
                  <kbd>R</kbd>
                  <span>Rotate part</span>
                </p>
                <p>
                  <kbd>Space</kbd>
                  <span>
                    Jump · <b>Q</b> for a good excuse
                  </span>
                </p>
              </>
            )}
          </div>
          <button className="primary-button" onClick={() => setHelp(false)}>
            Got it. More or less.
            <ArrowRight size={18} />
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="game-dialog">
          <DialogTitle className="dialog-heading">
            In the site cabin
          </DialogTitle>
          <DialogDescription>
            Make yourself at home on site.
            {session ? ' The shared game keeps running.' : ''}
          </DialogDescription>
          <label className="settings-row" htmlFor="site-sounds">
            Site sounds
            <Switch
              id="site-sounds"
              aria-label="Site sounds"
              checked={sound}
              onCheckedChange={setSound}
            />
          </label>
          <label className="settings-row">
            Game volume
            <input
              aria-label="Game volume"
              type="range"
              min="0"
              max="1"
              step=".05"
              value={gameVolume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setGameVolume(v);
                audio.current?.setVolume(v);
              }}
            />
          </label>
          <label className="settings-row" htmlFor="broadcast-mode">
            Broadcast mode
            <Switch
              id="broadcast-mode"
              aria-label="Broadcast mode"
              checked={broadcast}
              onCheckedChange={(value) => {
                setBroadcast(value);
                if (value) setInvite(false);
              }}
            />
          </label>
          <p className="muted-copy">
            Broadcast mode hides the room code, invite and secret job card on
            your screen.
          </p>
          <label className="settings-row" htmlFor="graphics-quality">
            Lighter graphics, more speed
            <Switch
              id="graphics-quality"
              aria-label="Lighter graphics"
              checked={lowQuality}
              onCheckedChange={setLowQuality}
            />
          </label>
          <p className="muted-copy">
            {compact
              ? 'Use the joystick to walk. Drag to rotate the camera; use two fingers to zoom and pan.'
              : 'Mouse and keyboard or touch: take your building site anywhere.'}
          </p>
          <a href="/chaos/admin" className="secondary-button">
            Audio admin
            <Settings2 size={17} />
          </a>
          <button
            className="secondary-button"
            onClick={() => {
              setSettings(false);
              setHelp(true);
            }}
          >
            View controls
            <BookOpen size={17} />
          </button>
          {isHost && (
            <button
              className="secondary-button"
              onClick={() => {
                setSettings(false);
                setResetMode(state!.world.mode);
              }}
            >
              Start a new site
              <RotateCw size={17} />
            </button>
          )}
          {session && (
            <button className="secondary-button" onClick={() => void leave()}>
              Leave site
              <LogOut size={17} />
            </button>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={invite && !broadcast} onOpenChange={setInvite}>
        <DialogContent className="game-dialog">
          <div className="dialog-icon">
            <Users size={29} />
          </div>
          <DialogTitle className="dialog-heading">Builders wanted.</DialogTitle>
          <DialogDescription>
            Send your friends the link or this room code. Up to four people can
            build together.
          </DialogDescription>
          <div className="invite-code">{session?.code}</div>
          {compact && (
            <button className="primary-button" onClick={() => void share(true)}>
              Invite friends
              <Share2 size={18} />
            </button>
          )}
          <button className="primary-button" onClick={() => void share()}>
            {copied ? 'Invite link copied!' : 'Copy invite link'}
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
          <input
            className="invite-url"
            aria-label="Invite link to copy"
            readOnly
            value={
              typeof location !== 'undefined' && session
                ? `${location.origin}${location.pathname}?raum=${session.code}`
                : ''
            }
            onFocus={(e) => e.target.select()}
          />
          <p className="muted-copy">
            Enter the room code under “Join your friends” on the start screen.
            Your building site stays saved.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!state?.world.party && finished && !dismissedResult}
        onOpenChange={(open) => {
          if (!open) setDismissedResult(true);
        }}
      >
        <DialogContent className="game-dialog result-dialog">
          <div className="result-stars">
            {progress && progress.ratio >= 1
              ? '★★★'
              : progress && progress.ratio >= 0.6
                ? '★★☆'
                : '★☆☆'}
          </div>
          <DialogTitle className="dialog-heading">
            {progress && progress.ratio >= 1
              ? 'Inspection passed!'
              : 'Built with good intentions.'}
          </DialogTitle>
          <DialogDescription>
            {progress && progress.ratio >= 1
              ? 'With reservations. But with style.'
              : 'The inspector is turning a blind eye today. Maybe both.'}
          </DialogDescription>
          <div className="result-stats">
            <span>
              <b>
                {progress?.done}/{progress?.total}
              </b>
              Building parts
            </span>
            <span>
              <b>{state?.world.throws || 0}</b>Throws
            </span>
            <span>
              <b>{state?.world.bonks || 0}</b>Bonks
            </span>
          </div>
          <button
            className="secondary-button"
            onClick={() => scene.current?.photo()}
          >
            Save evidence photo
            <Camera size={18} />
          </button>
          {isHost ? (
            <>
              <button
                className="primary-button"
                onClick={() => {
                  void perform({ type: 'reset', mode: 'job' });
                  setDismissedResult(false);
                }}
              >
                Next job
                <ArrowRight size={18} />
              </button>
              <button
                className="join-toggle"
                onClick={() => {
                  void perform({ type: 'reset', mode: 'sandbox' });
                  setDismissedResult(false);
                }}
              >
                Build freely now
              </button>
            </>
          ) : (
            <p className="muted-copy">
              The site manager starts the next round.
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!resetMode}
        onOpenChange={(open) => {
          if (!open) setResetMode(null);
        }}
      >
        <DialogContent className="game-dialog">
          <DialogTitle className="dialog-heading">
            Ready for a fresh start?
          </DialogTitle>
          <DialogDescription>
            A new site will replace the current one for everyone. Save an
            evidence photo first if you want to keep a memory of your work.
          </DialogDescription>
          <button
            className="secondary-button"
            onClick={() => scene.current?.photo()}
          >
            Save a photo first
            <Camera size={18} />
          </button>
          <button
            className="primary-button"
            onClick={() => {
              if (resetMode) void perform({ type: 'reset', mode: resetMode });
              setResetMode(null);
              setDismissedResult(false);
            }}
          >
            Start a new site
            <ArrowRight size={18} />
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
