import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { Context, Effect, Layer } from "effect";
import { DBError } from "./errors";
import { getDataDir } from "~/lib/paths";
import { runMigrations } from "./migrator";
import { migrations } from "./migrations";

const getDbPath = Effect.sync(() => {
  const dataDir = getDataDir();

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  return join(dataDir, "punch.db");
});

const DBLive = Effect.gen(function* () {
  const dbPath = yield* getDbPath;

  const sqlite = yield* Effect.try({
    try: () => new Database(dbPath),
    catch: (e) => new DBError({ path: dbPath, cause: e }),
  });

  // Auto-migrate on connection — idempotent, safe on every startup
  yield* runMigrations(sqlite, migrations);

  const db = drizzle(sqlite);

  return db;
});

export class DB extends Context.Tag("DBService")<
  DB,
  Effect.Effect.Success<typeof DBLive>
>() {
  static readonly Live = Layer.effect(DB, DBLive);
}
