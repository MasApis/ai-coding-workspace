import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";

export type AppDatabase = BetterSQLite3Database<typeof schema>;

export interface OpenDatabaseResult {
  db: AppDatabase;
  sqlite: InstanceType<typeof Database>;
  close: () => void;
}

const migrationsFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

// NOTE: path validation (workspace containment) lives at the CLI boundary
// (migrate.ts), not here. Tests and services pass explicit trusted paths.
export function openDatabase(dbFilePath: string): OpenDatabaseResult {
  const resolved = resolve(dbFilePath);
  mkdirSync(dirname(resolved), { recursive: true });

  const sqlite = new Database(resolved);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });

  return {
    db,
    sqlite,
    close: () => sqlite.close(),
  };
}
