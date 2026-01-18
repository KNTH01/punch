import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";

function getDbPath(): string {
  const home = process.env.HOME || "";
  const xdgDataHome = process.env.XDG_DATA_HOME || `${home}/.local/share`;
  const dataDir = `${xdgDataHome}/timetrack`;

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  return `${dataDir}/timetrack.db`;
}

const dbPath = getDbPath();
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./drizzle" });

console.log(`Migration successful - database at: ${dbPath}`);
