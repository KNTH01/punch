import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Effect, Layer } from "effect";
import { DB } from ".";

function createTestDb() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite);

  migrate(db, { migrationsFolder: "./drizzle" });

  return db;
}

export const DBTest = Layer.sync(DB, () => createTestDb());

export const withDB = <A>(fn: (db: BunSQLiteDatabase) => A) =>
  DB.pipe(Effect.flatMap((db) => Effect.try(() => fn(db))));
