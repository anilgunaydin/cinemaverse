/**
 * Script-specific database connection (bypasses server-only)
 * Only use in scripts, never in Next.js components
 */

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";

const DEFAULT_DB_PATH = "./data/cinemaverse.db";

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  const target = configured && configured.length > 0 ? configured : DEFAULT_DB_PATH;
  return path.isAbsolute(target) ? target : path.join(process.cwd(), target);
}

let dbInstance: ReturnType<typeof createDatabase> | null = null;

function createDatabase() {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  const db = drizzle(sqlite, { schema });

  return { db, sqlite, dbPath };
}

export function getScriptDatabase() {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance;
}