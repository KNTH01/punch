import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { Effect } from "effect";
import { getDataDir } from "./src/lib/paths";
import { runMigrations } from "./src/db/migrator";
import { migrations } from "./src/db/migrations";

const dataDir = getDataDir();
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, "punch.db");
const sqlite = new Database(dbPath);

Effect.runSync(runMigrations(sqlite, migrations));

console.log(`Migration successful (${dbPath})`);
