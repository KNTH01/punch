import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { Effect, Layer } from "effect";
import { DB } from ".";
import { runMigrations } from "./migrator";
import { migrations } from "./migrations";

function createTestDb() {
  const sqlite = new Database(":memory:");
  Effect.runSync(runMigrations(sqlite, migrations));
  return drizzle(sqlite);
}

export const DBTest = Layer.sync(DB, () => createTestDb());

export const withDB = <A>(fn: (db: BunSQLiteDatabase) => A) =>
  DB.pipe(Effect.flatMap((db) => Effect.try(() => fn(db))));
