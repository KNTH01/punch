import { test, expect, describe } from "bun:test";
import { Database } from "bun:sqlite";
import { Effect } from "effect";
import { runMigrations } from "./migrator";
import type { Migration } from "./migrations";

function createTestDb() {
  return new Database(":memory:");
}

describe("runMigrations", () => {
  test("creates _migrations tracking table", () => {
    const sqlite = createTestDb();
    const migrations: Migration[] = [];

    Effect.runSync(runMigrations(sqlite, migrations));

    const tables = sqlite
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'")
      .all();
    expect(tables).toHaveLength(1);
  });

  test("runs a single migration", () => {
    const sqlite = createTestDb();
    const migrations: Migration[] = [
      {
        id: "0000_initial",
        sql: "CREATE TABLE test_table (id TEXT PRIMARY KEY);",
      },
    ];

    Effect.runSync(runMigrations(sqlite, migrations));

    const tables = sqlite
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'")
      .all();
    expect(tables).toHaveLength(1);
  });

  test("records migration in _migrations table", () => {
    const sqlite = createTestDb();
    const migrations: Migration[] = [
      {
        id: "0000_initial",
        sql: "CREATE TABLE test_table (id TEXT PRIMARY KEY);",
      },
    ];

    Effect.runSync(runMigrations(sqlite, migrations));

    const records = sqlite.query("SELECT id FROM _migrations").all() as Array<{ id: string }>;
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe("0000_initial");
  });

  test("is idempotent — skips already-run migrations", () => {
    const sqlite = createTestDb();
    const migrations: Migration[] = [
      {
        id: "0000_initial",
        sql: "CREATE TABLE test_table (id TEXT PRIMARY KEY);",
      },
    ];

    Effect.runSync(runMigrations(sqlite, migrations));
    // Running again should not throw
    Effect.runSync(runMigrations(sqlite, migrations));

    const records = sqlite.query("SELECT id FROM _migrations").all();
    expect(records).toHaveLength(1);
  });

  test("runs multiple migrations in order", () => {
    const sqlite = createTestDb();
    const migrations: Migration[] = [
      {
        id: "0000_create_users",
        sql: "CREATE TABLE users (id TEXT PRIMARY KEY);",
      },
      {
        id: "0001_add_email",
        sql: "ALTER TABLE users ADD COLUMN email TEXT;",
      },
    ];

    Effect.runSync(runMigrations(sqlite, migrations));

    const records = sqlite.query("SELECT id FROM _migrations ORDER BY rowid").all() as Array<{ id: string }>;
    expect(records).toHaveLength(2);
    expect(records[0]?.id).toBe("0000_create_users");
    expect(records[1]?.id).toBe("0001_add_email");

    // Verify the column exists
    const cols = sqlite.query("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const colNames = cols.map((c) => c.name);
    expect(colNames).toContain("email");
  });

  test("only runs new migrations when some already applied", () => {
    const sqlite = createTestDb();
    const firstBatch: Migration[] = [
      {
        id: "0000_create_users",
        sql: "CREATE TABLE users (id TEXT PRIMARY KEY);",
      },
    ];

    Effect.runSync(runMigrations(sqlite, firstBatch));

    const secondBatch: Migration[] = [
      ...firstBatch,
      {
        id: "0001_add_email",
        sql: "ALTER TABLE users ADD COLUMN email TEXT;",
      },
    ];

    Effect.runSync(runMigrations(sqlite, secondBatch));

    const records = sqlite.query("SELECT id FROM _migrations ORDER BY rowid").all();
    expect(records).toHaveLength(2);
  });

  test("fails on invalid SQL and does not record migration", () => {
    const sqlite = createTestDb();
    const migrations: Migration[] = [
      {
        id: "0000_bad",
        sql: "THIS IS NOT VALID SQL;",
      },
    ];

    expect(() => Effect.runSync(runMigrations(sqlite, migrations))).toThrow();

    // Should not have recorded the failed migration
    const tables = sqlite
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'")
      .all();
    // Table may or may not exist depending on transaction rollback,
    // but if it does, it should have 0 records
    if (tables.length > 0) {
      const records = sqlite.query("SELECT id FROM _migrations").all();
      expect(records).toHaveLength(0);
    }
  });
});
