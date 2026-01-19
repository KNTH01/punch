import { test, expect, beforeEach, describe } from "bun:test";
import { createTestDb } from "../db/test-db";
import { punchEdit } from "./edit";
import { punchIn } from "./in";
import { entries } from "../db/schema";
import { eq } from "drizzle-orm";

describe("punch edit", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  test("edits active task name", async () => {
    await punchIn(db, "Original task");

    const result = await punchEdit(db, { taskName: "Updated task" });

    expect(result.taskName).toBe("Updated task");
  });

  test("falls back to last entry when no active task", async () => {
    const entry1 = (await punchIn(db, "First task"))!;
    const endTime = new Date(entry1.startTime);
    endTime.setHours(endTime.getHours() + 1);
    await db.update(entries).set({ endTime }).where(eq(entries.id, entry1.id));

    const result = await punchEdit(db, { taskName: "Updated first" });

    expect(result.taskName).toBe("Updated first");
    expect(result.id).toBe(entry1.id);
  });

  test("edits entry by ID prefix", async () => {
    const entry1 = (await punchIn(db, "First task"))!;
    const endTime1 = new Date(entry1.startTime);
    endTime1.setHours(endTime1.getHours() + 1);
    await db.update(entries).set({ endTime: endTime1 }).where(eq(entries.id, entry1.id));
    await punchIn(db, "Second task");

    const prefix = entry1.id.substring(0, 8);
    const result = await punchEdit(db, { idOrPosition: prefix, taskName: "Updated first" });

    expect(result.taskName).toBe("Updated first");
    expect(result.id).toBe(entry1.id);
  });

  test("edits entry by position -1", async () => {
    const entry1 = (await punchIn(db, "First task"))!;
    const endTime1 = new Date(entry1.startTime);
    endTime1.setHours(endTime1.getHours() + 1);
    await db.update(entries).set({ endTime: endTime1, startTime: new Date(entry1.startTime.getTime() - 3600000) }).where(eq(entries.id, entry1.id));

    const entry2 = (await punchIn(db, "Second task"))!;
    const endTime2 = new Date(entry2.startTime);
    endTime2.setHours(endTime2.getHours() + 1);
    await db.update(entries).set({ endTime: endTime2 }).where(eq(entries.id, entry2.id));

    const result = await punchEdit(db, { idOrPosition: "-1", taskName: "Updated last" });

    expect(result.taskName).toBe("Updated last");
    expect(result.id).toBe(entry2.id);
  });

  test("edits entry by position -2", async () => {
    const entry1 = (await punchIn(db, "First task"))!;
    const endTime1 = new Date(entry1.startTime);
    endTime1.setHours(endTime1.getHours() + 1);
    await db.update(entries).set({ endTime: endTime1, startTime: new Date(entry1.startTime.getTime() - 3600000) }).where(eq(entries.id, entry1.id));

    const entry2 = (await punchIn(db, "Second task"))!;
    const endTime2 = new Date(entry2.startTime);
    endTime2.setHours(endTime2.getHours() + 1);
    await db.update(entries).set({ endTime: endTime2 }).where(eq(entries.id, entry2.id));

    const result = await punchEdit(db, { idOrPosition: "-2", taskName: "Updated first" });

    expect(result.taskName).toBe("Updated first");
    expect(result.id).toBe(entry1.id);
  });

  test("updates project", async () => {
    await punchIn(db, "Task", { project: "old-project" });

    const result = await punchEdit(db, { project: "new-project" });

    expect(result.project).toBe("new-project");
  });

  test("updates start time", async () => {
    await punchIn(db, "Task");

    const result = await punchEdit(db, { start: "14:00" });

    expect(result.startTime.getHours()).toBe(14);
    expect(result.startTime.getMinutes()).toBe(0);
  });

  test("validates end time is after start time", async () => {
    const entry = (await punchIn(db, "Task"))!;
    await db.update(entries).set({
      startTime: new Date(2026, 0, 18, 14, 0),
      endTime: new Date(2026, 0, 18, 16, 0)
    }).where(eq(entries.id, entry.id));

    expect(async () => {
      await punchEdit(db, { idOrPosition: entry.id.substring(0, 8), start: "17:00" });
    }).toThrow("End time must be after start time");
  });
});
