/** drizzle migrasyonlarini manuel uygular (script'ler direct better-sqlite3 kullandigi icin). */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import * as schema from "../src/lib/db/schema";

const dbPath = process.env.DATABASE_PATH?.trim() || "./data/cinemaverse.db";
const resolved = path.isAbsolute(dbPath)
  ? dbPath
  : path.join(process.cwd(), dbPath);

const sqlite = new Database(resolved);
sqlite.pragma("journal_mode = WAL");

const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: "drizzle" });

console.log(`Migrasyonlar uygulandi: ${resolved}`);
sqlite.close();
