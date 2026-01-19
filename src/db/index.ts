import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { existsSync, mkdirSync } from "fs";

function getDbPath(): string {
  const home = process.env.HOME || "";
  const xdgDataHome = process.env.XDG_DATA_HOME || `${home}/.local/share`;
  const dataDir = `${xdgDataHome}/punch`;

  // Create directory if it doesn't exist
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  return `${dataDir}/punch.db`;
}

const dbPath = getDbPath();
const sqlite = new Database(dbPath);

export const db = drizzle(sqlite);

// Auto-run migrations on import
migrate(db, { migrationsFolder: "./drizzle" });
