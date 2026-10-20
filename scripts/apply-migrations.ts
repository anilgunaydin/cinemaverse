/** drizzle migrasyonlarini manuel uygular (script'ler direct better-sqlite3 kullandigi icin). */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../src/lib/db/schema";

const sqlite = new Database("data/cinemaverse.db");
sqlite.pragma("journal_mode = WAL");

const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: "drizzle" });

console.log("Migrasyonlar uygulandi.");
sqlite.close();
