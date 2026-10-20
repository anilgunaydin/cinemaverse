import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const dbPath = process.argv[2] ?? "./data/cinemaverse.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);
const folder = path.join(process.cwd(), "drizzle");
console.log("migrations folder:", folder, fs.existsSync(folder));
migrate(db, { migrationsFolder: folder });
const tables = sqlite
  .prepare("select name from sqlite_master where type='table' order by name")
  .all();
console.log("tables:", tables);
