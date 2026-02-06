import type { Database } from "bun:sqlite";
import { Effect } from "effect";
import type { Migration } from "./migrations";
import { DBError } from "./errors";

/** Run pending migrations against a raw SQLite database */
export function runMigrations(
  sqlite: Database,
  migrationList: ReadonlyArray<Migration>,
): Effect.Effect<void, DBError> {
  return Effect.try({
    try: () => {
      // Create tracking table if it doesn't exist
      sqlite.run(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id TEXT PRIMARY KEY NOT NULL,
          applied_at INTEGER NOT NULL
        );
      `);

      // Get already-applied migration ids
      const applied = new Set(
        (sqlite.query("SELECT id FROM _migrations").all() as Array<{ id: string }>)
          .map((row) => row.id),
      );

      // Run pending migrations in a transaction
      for (const migration of migrationList) {
        if (applied.has(migration.id)) continue;

        sqlite.run("BEGIN");
        try {
          sqlite.run(migration.sql);
          sqlite.run(
            "INSERT INTO _migrations (id, applied_at) VALUES (?, ?)",
            [migration.id, Date.now()],
          );
          sqlite.run("COMMIT");
        } catch (e) {
          sqlite.run("ROLLBACK");
          throw e;
        }
      }
    },
    catch: (e) => new DBError({ cause: e }),
  });
}
