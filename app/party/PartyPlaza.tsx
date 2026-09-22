'use client';
/* oxlint-disable react/react-compiler */
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Glasses, Play, Shirt, Sparkles } from 'lucide-react';
import { stateOf } from '@/platform/party/client';
import type { PartyRoomState } from '@/platform/party/types';
import {
  serverWardrobeSnapshot,
  subscribeWardrobe,
  wardrobeSnapshot,
} from '@/shared/wardrobe/wardrobe-state';
import {
  STATIONS,
  spawnPose,
  type PlazaPose,
  type PlazaStation,
} from '@/shared/plaza/world';
import PlazaView from '@/shared/plaza/PlazaView';

const WardrobeDialog = lazy(() => import('@/shared/wardrobe/WardrobeDialog'));

export default function PartyPlaza({
  room,
  playerId,
  token,
  onPresence,
}: {
  room: PartyRoomState;
  playerId: string;
  token: string;
  onPresence: (room: PartyRoomState) => void;
}) {
  const wardrobe = useSyncExternalStore(
    subscribeWardrobe,
    wardrobeSnapshot,
    serverWardrobeSnapshot,
  );
  const [shop, setShop] = useState<PlazaStation | null>(null),
    [opening, setOpening] = useState(false),
    [error, setError] = useState('');
  const me = room.players.find((p) => p.id === playerId);
  const pose = useRef<PlazaPose>(me?.lobbyPose ?? spawnPose(me?.color ?? 0));
  const latest = useRef({ look: wardrobe.look, browsing: false, onPresence });
  const sending = useRef<Promise<boolean> | null>(null),
    lastSent = useRef(''),
    alive = useRef(true),
    changingShop = useRef(false);
  useEffect(() => {
    latest.current.look = wardrobe.look;
    latest.current.onPresence = onPresence;
  }, [wardrobe.look, onPresence]);

  async function publish() {
    if (sending.current) await sending.current;
    if (!alive.current) return false;
    const body = {
      op: 'lobby_presence' as const,
      code: room.code,
      playerId,
      token,
      pose: pose.current,
      look: latest.current.look,
      browsing: latest.current.browsing,
    };
    const signature = JSON.stringify(body);
    const task = (async () => {
      try {
        const fresh = await stateOf(body);
        if (!alive.current) return false;
        const acknowledged = fresh.players.find(
          (p) => p.id === playerId,
        )?.lobbyPose;
        // Retry a clamped position after a slow connection until other players
        // see the same destination, even when the local avatar has stopped.
        lastSent.current =
          acknowledged &&
          Math.hypot(
            acknowledged.x - body.pose.x,
            acknowledged.z - body.pose.z,
          ) < 0.01
            ? signature
            : '';
        latest.current.onPresence(fresh);
        setError('');
        return true;
      } catch {
        if (alive.current)
          setError(
            'The plaza lost its connection. Your party is reconnecting.',
          );
        return false;
      }
    })();
    sending.current = task;
    try {
      return await task;
    } finally {
      if (sending.current === task) sending.current = null;
    }
  }
  const publishRef = useRef(publish);
  useEffect(() => {
    publishRef.current = publish;
  });
  useEffect(() => {
    alive.current = true;
    const timer = setInterval(() => {
      if (sending.current || document.hidden) return;
      const signature = JSON.stringify({
        op: 'lobby_presence',
        code: room.code,
        playerId,
        token,
        pose: pose.current,
        look: latest.current.look,
        browsing: latest.current.browsing,
      });
      if (signature !== lastSent.current) void publishRef.current();
    }, 350);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [room.code, playerId, token]);

  function focusPlay() {
    const footer = document.getElementById('party-ready-controls');
    footer?.scrollIntoView({ behavior: 'auto', block: 'center' });
    footer
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus({ preventScroll: true });
  }
  async function openShop(station: PlazaStation) {
    if (station.id === 'play') {
      focusPlay();
      return;
    }
    if (changingShop.current || shop) return;
    changingShop.current = true;
    setOpening(true);
    latest.current.browsing = true;
    const saved = await publishRef.current();
    if (alive.current) {
      if (saved) setShop(station);
      else latest.current.browsing = false;
      setOpening(false);
    }
    changingShop.current = false;
  }
  async function closeShop() {
    if (changingShop.current) return;
    changingShop.current = true;
    latest.current.browsing = false;
    await publishRef.current();
    // A dropped connection must not trap the player in a dialog. Presence retries
    // keep the server's ready gate closed until leaving the shop is acknowledged.
    if (alive.current) setShop(null);
    changingShop.current = false;
  }
  return (
    <section className="party-plaza" aria-label="Party shopping plaza">
      <div className="party-plaza-heading">
        <div>
          <h2>A little shopping. A lot of chaos.</h2>
          <p>Your outfits, your friends, your corner of Jumbleyard.</p>
        </div>
        <span>All games open during preview</span>
      </div>
      <PlazaView
        self={playerId}
        players={room.players.filter((p) => !p.isBot)}
        look={wardrobe.look}
        paused={!!shop || opening}
        onPose={(next) => {
          pose.current = next;
        }}
        onOpen={(station) => void openShop(station)}
      />
      <div className="plaza-shortcuts">
        <button
          type="button"
          disabled={opening || !!shop}
          onClick={() => void openShop(STATIONS[0])}
        >
          <Glasses size={17} /> Hat stand
        </button>
        <button
          type="button"
          disabled={opening || !!shop}
          onClick={() => void openShop(STATIONS[1])}
        >
          <Shirt size={17} /> Outfit workshop
        </button>
        <button
          type="button"
          disabled={opening || !!shop}
          onClick={() => void openShop(STATIONS[2])}
        >
          <Sparkles size={17} /> My wardrobe
        </button>
        <button type="button" disabled={opening || !!shop} onClick={focusPlay}>
          <Play size={17} /> Get ready
        </button>
      </div>
      {error && <output className="plaza-shop-error">{error}</output>}
      {shop && (
        <Suspense
          fallback={
            <div>
              <output>Opening the wardrobe…</output>{' '}
              <button type="button" onClick={() => void closeShop()}>
                Cancel
              </button>
            </div>
          }
        >
          <WardrobeDialog
            open
            onClose={() => void closeShop()}
            initialSlot={shop.slot}
            initialItemId={shop.item || undefined}
          />
        </Suspense>
      )}
    </section>
  );
}
