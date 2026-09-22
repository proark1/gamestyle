import { apiFetch } from '../browser/api-fetch';
import {
  accountSnapshot,
  subscribeAccount,
  refreshAccount,
} from '../accounts/client';
import {
  buyItem,
  equipItem,
  guestWardrobeSnapshot,
  setAccountWardrobe,
  wardrobeSnapshot,
} from '../wardrobe/wardrobe-state';
import type { Slot } from '../wardrobe/catalog';
import {
  createInventoryClient,
  INITIAL_INVENTORY,
  type InventoryReply,
} from './client-store';

const client = createInventoryClient(
  async (body) => {
    const response = await apiFetch('/api/account/inventory', {
      method: body ? 'POST' : 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      ...(body
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
    });
    const reply = await response.json();
    if (!response.ok) {
      if (response.status === 401) void refreshAccount(true);
      throw new Error(
        reply.error ?? 'Your wardrobe could not be saved. Try again.',
      );
    }
    return reply as InventoryReply;
  },
  (state) => {
    const inventory = state.inventory;
    setAccountWardrobe(
      inventory
        ? {
            look: inventory.look,
            coins: inventory.coins,
            unlockedItems: inventory.items,
            stats: { gamesPlayed: [], playTimeSeconds: 0 },
          }
        : null,
      state.mode !== 'guest',
    );
  },
);

export const inventorySnapshot = client.snapshot;
export const serverInventorySnapshot = () => INITIAL_INVENTORY;
export const subscribeInventory = client.subscribe;

export function refreshInventory() {
  const guest = guestWardrobeSnapshot();
  return client.connect(!!accountSnapshot().account, {
    items: guest.unlockedItems,
    look: guest.look,
  });
}

let users = 0;
let unsubscribe: (() => void) | undefined;
let previousAccount = accountSnapshot().account;

export function connectAccountInventory() {
  if (users++ === 0) {
    previousAccount = accountSnapshot().account;
    unsubscribe = subscribeAccount(() => {
      const next = accountSnapshot();
      if (next.status !== 'ready' || next.account === previousAccount) return;
      previousAccount = next.account;
      void refreshInventory();
    });
    if (accountSnapshot().status === 'ready') void refreshInventory();
  }
  return () => {
    if (--users === 0) {
      unsubscribe?.();
      unsubscribe = undefined;
      void client.connect(false, { items: [], look: {} });
    }
  };
}

export async function purchaseWardrobeItem(id: string) {
  if (client.snapshot().mode === 'guest') return buyItem(id);
  return client.change({ op: 'buy_coins', itemId: id });
}

export async function saveWardrobeItem(slot: Slot, id: string | null) {
  if (client.snapshot().mode === 'guest') {
    equipItem(slot, id);
    return true;
  }
  const look = { ...wardrobeSnapshot().look };
  if (id) look[slot] = id;
  else delete look[slot];
  return client.change({ op: 'equip', look });
}
