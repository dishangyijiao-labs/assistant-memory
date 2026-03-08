/**
 * Thin compatibility layer over node:sqlite's DatabaseSync.
 *
 * Provides the subset of the better-sqlite3 API surface used by this project:
 *   - db.prepare(sql)  → statement with .run(), .get(), .all()
 *   - db.exec(sql)
 *   - db.close()
 *   - db.transaction(fn)
 *
 * This lets the rest of the codebase stay unchanged.
 */

import { DatabaseSync } from "node:sqlite";

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface CompatStatement {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface CompatDatabase {
  prepare(sql: string): CompatStatement;
  exec(sql: string): void;
  close(): void;
  transaction<T extends unknown[], R>(fn: (...args: T) => R): (...args: T) => R;
}

function wrapStatement(raw: ReturnType<DatabaseSync["prepare"]>): CompatStatement {
  return {
    run(...params: unknown[]): RunResult {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return raw.run(...(params as any[])) as RunResult;
    },
    get(...params: unknown[]): unknown {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return raw.get(...(params as any[]));
    },
    all(...params: unknown[]): unknown[] {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return raw.all(...(params as any[]));
    },
  };
}

export function openDatabase(path: string, options?: { readonly?: boolean }): CompatDatabase {
  const raw = new DatabaseSync(path, {
    readOnly: options?.readonly ?? false,
  });

  const db: CompatDatabase = {
    prepare(sql: string): CompatStatement {
      return wrapStatement(raw.prepare(sql));
    },
    exec(sql: string): void {
      raw.exec(sql);
    },
    close(): void {
      raw.close();
    },
    transaction<T extends unknown[], R>(fn: (...args: T) => R): (...args: T) => R {
      return (...args: T): R => {
        raw.exec("BEGIN");
        try {
          const result = fn(...args);
          raw.exec("COMMIT");
          return result;
        } catch (err) {
          raw.exec("ROLLBACK");
          throw err;
        }
      };
    },
  };

  return db;
}
