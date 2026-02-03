import { test, expect, beforeEach, describe } from "bun:test";
import { Effect, Exit } from "effect";
import { createTestDb } from "../db/test-db";
import { punchIn } from "~/core/punch-in";
import { punchOut } from "~/core/punch-out";
import { entries } from "~/db/schema";
import { InvalidEndTimeError, NoActiveTask } from "~/core/errors";

describe("punch out", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  test("sets end time on active task", async () => {
    await Effect.runPromise(punchIn(db, "Fix bug"));

    // Wait 1ms to ensure different timestamp
    await Bun.sleep(1);

    await Effect.runPromise(punchOut(db));

    const entry = db.select().from(entries).get();
    expect(entry?.endTime).toBeInstanceOf(Date);
    expect(entry?.endTime?.getTime()).toBeGreaterThan(
      entry?.startTime.getTime() || 0,
    );
  });

  test("fails with NoActiveTask if no active task", async () => {
    const exit = await Effect.runPromiseExit(punchOut(db));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = exit.cause.toString();
      expect(error).toContain("NoActiveTask");
    }
  });

  test("accepts custom end time with --at option", async () => {
    await Effect.runPromise(punchIn(db, "Fix bug"));
    await Effect.runPromise(punchOut(db, { at: "14:30" }));

    const entry = db.select().from(entries).get();
    expect(entry?.endTime?.getHours()).toBe(14);
    expect(entry?.endTime?.getMinutes()).toBe(30);
  });

  test("fails with InvalidEndTimeError when end time before start time", async () => {
    // Insert task that started at 14:00 today
    const startTime = new Date();
    startTime.setHours(14, 0, 0, 0);
    await db.insert(entries).values({
      taskName: "Fix bug",
      startTime,
      endTime: null,
    });

    // Try to end at 12:00 (before 14:00)
    const exit = await Effect.runPromiseExit(punchOut(db, { at: "12:00" }));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = exit.cause.toString();
      expect(error).toContain("InvalidEndTimeError");
    }
  });
});
