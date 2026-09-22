'use client';
import { publicGameOrigin } from '../browser/public-url';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { GameId } from '../audio/types';
import { inviteCode, sessionStore, type Session } from '../rooms/session';
import type { VoiceSession, VoiceSnapshot } from '../voice/types';
import { enterPeerRoom, PeerGameConnection } from './connection';
import type { EngineLoader } from './engine';

type RoomSnapshot = {
  world: { players: { id: string; name: string; bot?: boolean }[] };
};
type Options<S> = {
  game: GameId;
  loadEngine: EngineLoader;
  readInput: () => unknown;
  idleInput: () => unknown;
  onAttach: (session: Session) => void;
  onOpen?: () => void;
  receive: (snapshot: S) => void;
};

export type PeerRoomUI = {
  session: Session | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  name: string;
  setName: (name: string) => void;
  code: string;
  setCode: (code: string) => void;
  busy: boolean;
  notice: string;
  status: 'online' | 'reconnecting' | 'expired';
  players: VoiceSnapshot['players'];
  enter: (op: 'create' | 'join') => Promise<void>;
  leave: () => Promise<void>;
  copyInvite: () => Promise<void>;
  voice: { session: VoiceSession; snapshot: VoiceSnapshot } | undefined;
};

/** The existing peer-room flow, shared by games that also start in solo practice. */
export function usePeerRoom<S extends RoomSnapshot>(options: Options<S>) {
  const callbacks = useRef(options);
  useLayoutEffect(() => {
    callbacks.current = options;
  });
  const network = useRef<PeerGameConnection<S> | null>(null);
  const latest = useRef<S | null>(null);
  const active = useRef(false);
  const mounted = useRef(false);
  const entering = useRef(false);
  const blocked = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState<PeerRoomUI['status']>('online');
  const [players, setPlayers] = useState<VoiceSnapshot['players']>([]);
  const roster = useRef('');
  const game = options.game;
  useLayoutEffect(() => {
    if (open) callbacks.current.onOpen?.();
  }, [open]);
  useLayoutEffect(() => {
    blocked.current = open || busy || (session !== null && status !== 'online');
  }, [open, busy, session, status]);

  const attach = useCallback(
    (next: Session, preview?: S) => {
      network.current?.stop();
      active.current = true;
      latest.current = null;
      callbacks.current.onAttach(next);
      setSession(next);
      setStatus('reconnecting');
      sessionStore(`${game}-session-v1`).save(next);
      const receive = (snap: S) => {
        latest.current = snap;
        const humans = snap.world.players.filter((p) => !p.bot);
        const key = JSON.stringify(humans.map((p) => [p.id, p.name]));
        if (key !== roster.current) {
          roster.current = key;
          setPlayers(humans.map(({ id, name }) => ({ id, name })));
        }
        callbacks.current.receive(snap);
      };
      network.current = new PeerGameConnection(
        game,
        next,
        () =>
          blocked.current
            ? callbacks.current.idleInput()
            : callbacks.current.readInput(),
        receive,
        setStatus,
        () => callbacks.current.loadEngine(),
      );
      if (preview) receive(preview);
      network.current.start();
    },
    [game],
  );

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    // Let the game's scene effect finish before restoring a saved room.
    queueMicrotask(() => {
      if (disposed) return;
      const invite = inviteCode();
      const saved = sessionStore(`${game}-session-v1`).loadPeer();
      if (saved && (!invite || invite === saved.code)) attach(saved);
      else if (invite) {
        setCode(invite);
        setOpen(true);
      }
    });
    return () => {
      disposed = true;
      mounted.current = false;
      network.current?.stop();
      network.current = null;
      active.current = false;
    };
  }, [game, attach]);

  const send = useCallback((action: unknown): boolean => {
    if (blocked.current) return true;
    if (!active.current) return false;
    void network.current?.action(action).catch((error: Error) => {
      if (mounted.current) setNotice(error.message);
    });
    return true;
  }, []);

  async function enter(op: 'create' | 'join') {
    if (entering.current) return;
    entering.current = true;
    setBusy(true);
    setNotice('');
    try {
      const reply = await enterPeerRoom<S>(
        game,
        {
          op,
          name: name.trim() || 'Player',
          ...(op === 'join' ? { code: code.trim().toUpperCase() } : {}),
        },
        () => callbacks.current.loadEngine(),
      );
      if (!mounted.current) return;
      if (!reply.session)
        throw new Error('Could not join the room. Try again.');
      attach(reply.session, reply.snapshot);
      setOpen(false);
      const url = new URL(location.href);
      url.searchParams.set('room', reply.session.code);
      history.replaceState(null, '', url);
    } catch (error) {
      if (mounted.current)
        setNotice(
          error instanceof Error ? error.message : 'Could not connect.',
        );
    } finally {
      entering.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function leave() {
    if (entering.current) return;
    entering.current = true;
    setBusy(true);
    try {
      await network.current?.leave();
    } catch {
      network.current?.stop();
    } finally {
      sessionStore(`${game}-session-v1`).clear();
      if (mounted.current) {
        const url = new URL(location.href);
        url.searchParams.delete('room');
        // Reuse each game's existing solo startup and clean up all scene resources.
        location.replace(url.href);
      }
    }
  }

  async function copyInvite() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(
        `${publicGameOrigin()}/${game}?room=${session.code}`,
      );
      setNotice('Invite link copied.');
    } catch {
      setNotice(`Room code: ${session.code}`);
    }
  }

  const voice = session?.peer
    ? {
        session: { ...session, game },
        snapshot: { players, nearby: false },
      }
    : undefined;
  return {
    session,
    open,
    setOpen,
    name,
    setName,
    code,
    setCode,
    busy,
    notice,
    status,
    players,
    enter,
    leave,
    copyInvite,
    voice,
    active,
    latest,
    blocked,
    send,
  };
}
