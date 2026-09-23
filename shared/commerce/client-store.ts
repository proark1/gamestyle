import type { InventorySnapshot } from './types';

export type InventoryReply = {
  inventory: InventorySnapshot;
  purchasesAvailable: boolean;
  ownerKey?: string;
};
export type InventoryClientState = {
  mode: 'guest' | 'loading' | 'account' | 'error';
  busy: boolean;
  error: string;
  inventory: InventorySnapshot | null;
  purchasesAvailable: boolean;
};
export const INITIAL_INVENTORY: InventoryClientState = {
  mode: 'guest',
  busy: false,
  error: '',
  inventory: null,
  purchasesAvailable: false,
};

/** Isolated state machine: old requests cannot apply to a newer session. */
export function createInventoryClient(
  send: (body?: object) => Promise<InventoryReply>,
  apply: (state: InventoryClientState) => void,
) {
  let state = INITIAL_INVENTORY;
  let generation = 0;
  let account = false;
  let ownerKey: string | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: InventoryClientState) => {
    state = next;
    apply(state);
    for (const listener of listeners) listener();
  };
  const message = (error: unknown) =>
    error instanceof Error
      ? error.message
      : 'Your wardrobe could not be saved. Try again.';

  async function connect(
    signedIn: boolean,
    legacy: { items: string[]; look: object },
  ) {
    const asked = ++generation;
    account = signedIn;
    ownerKey = undefined;
    if (!signedIn) {
      publish(INITIAL_INVENTORY);
      return;
    }
    publish({
      mode: 'loading',
      busy: true,
      error: '',
      inventory: null,
      purchasesAvailable: false,
    });
    try {
      let reply = await send();
      if (asked !== generation) return;
      ownerKey = reply.ownerKey;
      if (!reply.inventory.legacyImported)
        reply = await send({ op: 'import_legacy', ...legacy, ownerKey });
      if (asked !== generation) return;
      publish({
        mode: 'account',
        busy: false,
        error: '',
        inventory: reply.inventory,
        purchasesAvailable: reply.purchasesAvailable,
      });
    } catch (error) {
      if (asked === generation)
        publish({
          mode: 'error',
          busy: false,
          error: message(error),
          inventory: null,
          purchasesAvailable: false,
        });
    }
  }

  async function change(body: object) {
    if (!account || state.mode !== 'account' || state.busy) return false;
    const asked = generation;
    publish({ ...state, busy: true, error: '' });
    try {
      const reply = await send({ ...body, ownerKey });
      if (asked !== generation) return false;
      publish({
        mode: 'account',
        busy: false,
        error: '',
        inventory: reply.inventory,
        purchasesAvailable: reply.purchasesAvailable,
      });
      return true;
    } catch (error) {
      if (asked === generation)
        publish({ ...state, busy: false, error: message(error) });
      return false;
    }
  }

  return {
    connect,
    change,
    snapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
