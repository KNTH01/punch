import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { existsSync, mkdirSync } from "fs";
import { Context, Effect, Layer } from "effect";
import { DBError } from "./errors";

const getDbPath = Effect.sync(() => {
  const home = process.env.HOME || "";
  const xdgDataHome = process.env.XDG_DATA_HOME || `${home}/.local/share`;
  const dataDir = `${xdgDataHome}/punch`;

  // Create directory if it doesn't exist
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  return `${dataDir}/punch.db`;
});

const DBLive = Effect.gen(function* () {
  const dbPath = yield* getDbPath;

  const sqlite = yield* Effect.try({
    try: () => new Database(dbPath),
    catch: (e) => new DBError({ path: dbPath, cause: e }),
  });

  const db = drizzle(sqlite);

  return db;
});

export class DB extends Context.Tag("DBService")<
  DB,
  Effect.Effect.Success<typeof DBLive>
>() {
  static readonly Live = Layer.effect(DB, DBLive);
}

/** Run migrations - exported for migrate.ts script */
export const runMigrations = Effect.gen(function* () {
  const db = yield* DBLive;
  migrate(db, { migrationsFolder: "./drizzle" });
});
