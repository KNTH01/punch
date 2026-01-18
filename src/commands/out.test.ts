import { test, expect, beforeEach, describe } from "bun:test";
import { createTestDb } from "../db/test-db";
import { punchIn } from "./in";
import { punchOut } from "./out";
import { entries } from "../db/schema";

describe("punch out", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  test("sets end time on active task", async () => {
    await punchIn(db, "Fix bug");

    // Wait 1ms to ensure different timestamp
    await Bun.sleep(1);

    const result = await punchOut(db);

    const entry = db.select().from(entries).get();
    expect(entry?.endTime).toBeInstanceOf(Date);
    expect(entry?.endTime?.getTime()).toBeGreaterThan(
      entry?.startTime.getTime() || 0
    );
  });
});
