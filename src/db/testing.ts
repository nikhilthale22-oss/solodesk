// Test-only SQL backend: a real in-memory SQLite (better-sqlite3) with the
// exact production migrations applied. Because it runs the real engine with
// foreign_keys ON — same as the sqlx runtime — tests exercise real cascade
// behavior, not a mock. Excluded from the production tsconfig.

import BetterSqlite3 from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { SqlDriver } from "./client";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, "..", "..", "src-tauri", "migrations");
const FILES = ["001_init.sql", "002_scheduling.sql", "003_oplog_append_only.sql"];

/** Rewrite sqlx-style `$1,$2,…` placeholders (which may repeat) into the
 *  positional `?` form better-sqlite3 expects, expanding params to match. */
function toQmark(sql: string, params: unknown[]): { q: string; args: unknown[] } {
  const args: unknown[] = [];
  const q = sql.replace(/\$(\d+)/g, (_m, n: string) => {
    args.push(params[Number(n) - 1]);
    return "?";
  });
  return { q, args };
}

function norm(v: unknown): unknown {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

export interface TestDb {
  driver: SqlDriver;
  raw: BetterSqlite3.Database;
}

export function makeTestDb(): TestDb {
  const db = new BetterSqlite3(":memory:");
  db.pragma("foreign_keys = ON"); // match the sqlx runtime — cascade IS enforced
  for (const f of FILES) db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  db.pragma("foreign_keys = ON");
  const driver: SqlDriver = {
    execute: async (sql, params) => {
      const { q, args } = toQmark(sql, params);
      db.prepare(q).run(...args.map(norm));
    },
    select: async (sql, params) => {
      const { q, args } = toQmark(sql, params);
      return db.prepare(q).all(...args.map(norm)) as never;
    },
  };
  return { driver, raw: db };
}
