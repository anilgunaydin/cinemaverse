import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";

const DEFAULT_DB_PATH = "./data/cinemaverse.db";

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  const target =
    configured && configured.length > 0 ? configured : DEFAULT_DB_PATH;
  // Turbopack'in tum projeyi izlemesini engellemek icin yol sabit tutulur.
  return path.isAbsolute(target)
    ? target
    : path.join(/* turbopackIgnore: true */ process.cwd(), target);
}

declare global {
  var __cinemaverseDb: ReturnType<typeof createDatabase> | undefined;
}

function createDatabase() {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  const db = drizzle(sqlite, { schema });

  // Turbopack'in tum projeyi izlemesini engellemek icin yol sabit tutulur.
  const migrationsFolder = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "drizzle",
  );
  if (fs.existsSync(migrationsFolder)) {
    migrate(db, { migrationsFolder });
  }

  return { db, sqlite, dbPath };
}

/**
 * Tek bir baglanti ornegi (dev modda HMR sirasinda yeniden kullanilir).
 */
export function getDatabase() {
  if (!globalThis.__cinemaverseDb) {
    globalThis.__cinemaverseDb = createDatabase();
  }
  return globalThis.__cinemaverseDb;
}

export function getDb() {
  return getDatabase().db;
}

export { schema };
