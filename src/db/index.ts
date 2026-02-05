import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { existsSync, mkdirSync } from "fs";
import { Context, Data, Effect, Layer } from "effect";

class DBOpenError extends Data.TaggedError("DBOpenError")<{
  path: string;
  cause: unknown;
}> {}

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
    catch: (e) => new DBOpenError({ path: dbPath, cause: e }),
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

// TODO: delete this
export const db = Effect.runSync(DBLive);

// Auto-run migrations on import
// TODO: why do we need this?
migrate(db, { migrationsFolder: "./drizzle" });
