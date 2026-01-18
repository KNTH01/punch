import { test, expect, beforeEach, describe } from "bun:test";
import { createTestDb } from "../db/test-db";
import { punchIn } from "./in";
import { entries } from "../db/schema";

describe("punch in", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  test("creates entry with start time and no end time", async () => {
    const result = await punchIn(db, "Fix bug");
    expect(result).toBeDefined();

    const allEntries = db.select().from(entries).all();
    expect(allEntries).toHaveLength(1);
    expect(allEntries[0]?.taskName).toBe("Fix bug");
    expect(allEntries[0]?.startTime).toBeInstanceOf(Date);
    expect(allEntries[0]?.endTime).toBeNull();
    expect(allEntries[0]?.project).toBeNull();
  });

  test("throws error if active task already exists", async () => {
    await punchIn(db, "First task");

    expect(async () => {
      await punchIn(db, "Second task");
    }).toThrow("already running");
  });

  test("creates entry with project when provided", async () => {
    const result = await punchIn(db, "Fix bug", { project: "acme-app" });
    expect(result).toBeDefined();

    const entry = db.select().from(entries).get();
    expect(entry?.project).toBe("acme-app");
  });
});
