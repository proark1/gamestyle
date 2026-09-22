import type { Look } from '../wardrobe/look';

export type CommerceEnvironment = 'live' | 'sandbox';

export type InventorySnapshot = {
  coins: number;
  items: string[];
  look: Look;
  fullGame: boolean;
  legacyImported: boolean;
  environment: CommerceEnvironment;
};

export class CommerceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
