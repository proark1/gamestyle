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
};

export class RoomError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
