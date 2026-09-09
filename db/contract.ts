export type SqlValue = string | number | null;
export type WriteResult = { meta: { changes: number } };

export interface GameStatement {
  bind(...values: SqlValue[]): GameStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<WriteResult>;
}

export interface GameDatabase {
  prepare(sql: string): GameStatement;
  batch(statements: GameStatement[]): Promise<unknown[]>;
}
