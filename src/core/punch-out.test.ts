import { test, expect, beforeEach, describe } from "bun:test";
import { Effect } from "effect";
import { createTestDb } from "../db/test-db";
import { punchIn } from "~/core/punch-in";
import { punchOut } from "~/core/punch-out";
import { entries } from "~/db/schema";

describe("punch out", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  test("sets end time on active task", async () => {
    await Effect.runPromise(punchIn(db, "Fix bug"));

    // Wait 1ms to ensure different timestamp
    await Bun.sleep(1);

    const result = await punchOut(db);

    const entry = db.select().from(entries).get();
    expect(entry?.endTime).toBeInstanceOf(Date);
    expect(entry?.endTime?.getTime()).toBeGreaterThan(
      entry?.startTime.getTime() || 0,
    );
  });

  test("throws error if no active task", async () => {
    expect(async () => {
      await punchOut(db);
    }).toThrow("No active task to stop");
  });

  test("accepts custom end time with --at option", async () => {
    await Effect.runPromise(punchIn(db, "Fix bug"));

    await punchOut(db, { at: "14:30" });

    const entry = db.select().from(entries).get();
    expect(entry?.endTime?.getHours()).toBe(14);
    expect(entry?.endTime?.getMinutes()).toBe(30);
  });

  test("rejects end time before start time", async () => {
    // Start at current time
    await Effect.runPromise(punchIn(db, "Fix bug"));

    // Try to end 2 hours in the past
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    const timeStr = `${twoHoursAgo.getHours()}:${String(twoHoursAgo.getMinutes()).padStart(2, "0")}`;

    expect(async () => {
      await punchOut(db, { at: timeStr });
    }).toThrow("End time must be after start time");
  });
});
