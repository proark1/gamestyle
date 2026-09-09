import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type {
  GameDatabase,
  GameStatement,
  SqlValue,
  WriteResult,
} from './contract';
import { getSqliteDatabase } from './sqlite.mjs';

const adapters = new WeakMap<DatabaseSync, GameDatabase>();

class Statement implements GameStatement {
  constructor(
    readonly database: DatabaseSync,
    private sql: string,
    private compiled: (sql: string) => StatementSync,
    private schedule: (statements: GameStatement[]) => Promise<WriteResult[]>,
    private values: SqlValue[] = [],
  ) {}
  bind(...values: SqlValue[]) {
    return new Statement(
      this.database,
      this.sql,
      this.compiled,
      this.schedule,
      values,
    );
  }
  async first<T>(): Promise<T | null> {
    return (
      (this.compiled(this.sql).get(...this.values) as T | undefined) ?? null
    );
  }
  async all<T>(): Promise<{ results: T[] }> {
    return {
      results: this.compiled(this.sql).all(...this.values) as T[],
    };
  }
  execute(): WriteResult {
    const result = this.compiled(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
  async run() {
    return (await this.schedule([this]))[0];
  }
}

export function sqliteAdapter(database: DatabaseSync): GameDatabase {
  const existing = adapters.get(database);
  if (existing) return existing;
  // Bound the cache even if a future caller builds variable SQL. Bound values
  // stay on each wrapper; simultaneous requests cannot reuse another's values.
  const statements = new Map<string, StatementSync>();
  const compiled = (sql: string) => {
    const statement = statements.get(sql) ?? database.prepare(sql);
    statements.delete(sql);
    statements.set(sql, statement);
    if (statements.size > 256)
      statements.delete(statements.keys().next().value!);
    return statement;
  };
  type PendingBatch = {
    statements: GameStatement[];
    resolve: (value: WriteResult[]) => void;
    reject: (error: unknown) => void;
  };
  let pending: PendingBatch[] = [],
    scheduled = false;
  const flush = () => {
    const group = pending;
    pending = [];
    scheduled = false;
    const outcomes: {
      item: PendingBatch;
      results?: WriteResult[];
      error?: unknown;
    }[] = [];
    try {
      database.exec('BEGIN IMMEDIATE');
      for (const [index, item] of group.entries()) {
        const savepoint = `game_batch_${index}`;
        database.exec(`SAVEPOINT ${savepoint}`);
        try {
          const results = item.statements.map((statement) => {
            if (
              !(statement instanceof Statement) ||
              statement.database !== database
            )
              throw new Error('SQLITE invalid batch statement');
            return statement.execute();
          });
          database.exec(`RELEASE ${savepoint}`);
          outcomes.push({ item, results });
        } catch (error) {
          database.exec(`ROLLBACK TO ${savepoint}`);
          database.exec(`RELEASE ${savepoint}`);
          outcomes.push({ item, error });
        }
      }
      database.exec('COMMIT');
      // Acknowledgements wait for the durable commit, including every successful site.
      for (const outcome of outcomes)
        if (outcome.results) outcome.item.resolve(outcome.results);
        else outcome.item.reject(outcome.error);
    } catch (error) {
      try {
        database.exec('ROLLBACK');
      } catch {
        /* BEGIN or COMMIT may already have closed the transaction. */
      }
      for (const item of group) item.reject(error);
    }
  };
  const schedule = (statements: GameStatement[]) =>
    new Promise<WriteResult[]>((resolve, reject) => {
      pending.push({ statements, resolve, reject });
      if (!scheduled) {
        scheduled = true;
        setTimeout(flush, 2);
      }
    });
  const adapter: GameDatabase = {
    prepare(sql) {
      return new Statement(database, sql, compiled, schedule);
    },
    batch(statements) {
      // Share a disk flush among ready sites without sharing their rollback scope.
      return schedule(statements);
    },
  };
  adapters.set(database, adapter);
  return adapter;
}

let binding: GameDatabase | undefined;
export function getBinding(): GameDatabase {
  return (binding ??= sqliteAdapter(getSqliteDatabase()));
}
