export type Row = {
  code: string;
  state: string;
  version: number;
  updated: number;
};

export type RoomStore = {
  get(code: string): Promise<Row | null>;
  insert(row: Row): Promise<boolean>;
  compareAndSwap(row: Row, version: number): Promise<boolean>;
  /** Optional so test doubles and future stores need not implement it.
   *  Rooms are unreachable after a day; without this the rows still accumulate. */
  purge?(before: number): Promise<number>;
};

export class RoomError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
