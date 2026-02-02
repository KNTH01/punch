import { test, expect, beforeEach, describe } from "bun:test";
import { Effect } from "effect";
import { createTestDb } from "../db/test-db";
import { punchLog } from "./log";
import { punchIn } from "../core/punch-in";
import { punchOut } from "./out";
import { entries } from "../db/schema";

describe("punch log", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  test("shows today's entries by default", async () => {
    await Effect.runPromise(punchIn(db, "Task 1"));
    await Bun.sleep(1);
    await punchOut(db);
    await Effect.runPromise(punchIn(db, "Task 2"));

    const results = await punchLog(db);

    expect(results).toHaveLength(2);
    expect(results[0]!.taskName).toBe("Task 1");
    expect(results[1]!.taskName).toBe("Task 2");
  });

  test("returns empty array when no entries today", async () => {
    const results = await punchLog(db);
    expect(results).toEqual([]);
  });

  test("shows active task with null endTime and (active) duration", async () => {
    await Effect.runPromise(punchIn(db, "Active task"));

    const results = await punchLog(db);

    expect(results).toHaveLength(1);
    expect(results[0]!.taskName).toBe("Active task");
    expect(results[0]!.endTime).toBeNull();
    expect(results[0]!.duration).toBeNull();
    expect(results[0]!.formattedDuration).toBe("(active)");
    expect(results[0]!.formattedEnd).toBe("");
  });

  test("filters by project", async () => {
    await Effect.runPromise(punchIn(db, "Task A", { project: "project-a" }));
    await Bun.sleep(1);
    await punchOut(db);
    await Effect.runPromise(punchIn(db, "Task B", { project: "project-b" }));
    await Bun.sleep(1);
    await punchOut(db);
    await Effect.runPromise(punchIn(db, "Task C", { project: "project-a" }));

    const results = await punchLog(db, { project: "project-a" });

    expect(results).toHaveLength(2);
    expect(results[0]!.taskName).toBe("Task A");
    expect(results[1]!.taskName).toBe("Task C");
    expect(results[0]!.project).toBe("project-a");
    expect(results[1]!.project).toBe("project-a");
  });

  test("returns entries in chronological order", async () => {
    // Insert entries at different times
    await Effect.runPromise(punchIn(db, "First"));
    await Bun.sleep(1);
    await punchOut(db);
    await Bun.sleep(10);
    await Effect.runPromise(punchIn(db, "Second"));
    await Bun.sleep(1);
    await punchOut(db);
    await Bun.sleep(10);
    await Effect.runPromise(punchIn(db, "Third"));

    const results = await punchLog(db);

    expect(results).toHaveLength(3);
    expect(results[0]!.taskName).toBe("First");
    expect(results[1]!.taskName).toBe("Second");
    expect(results[2]!.taskName).toBe("Third");
    // Verify ordering by comparing timestamps
    expect(results[0]!.startTime.getTime()).toBeLessThan(results[1]!.startTime.getTime());
    expect(results[1]!.startTime.getTime()).toBeLessThan(results[2]!.startTime.getTime());
  });

  test("calculates duration accurately", async () => {
    await Effect.runPromise(punchIn(db, "Timed task"));
    await Bun.sleep(100); // Wait 100ms
    await punchOut(db);

    const results = await punchLog(db);

    expect(results).toHaveLength(1);
    expect(results[0]!.duration).toBeGreaterThanOrEqual(100);
    expect(results[0]!.duration).toBeLessThan(200); // Allow some margin
    expect(results[0]!.endTime).not.toBeNull();
  });

  test("week filter excludes entries older than current week", async () => {
    const now = new Date();

    // Create entry from 2 weeks ago
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    await db.insert(entries).values({
      taskName: "Old task",
      project: null,
      startTime: twoWeeksAgo,
      endTime: new Date(twoWeeksAgo.getTime() + 3600000), // 1 hour later
    });

    // Create entry from this week
    await Effect.runPromise(punchIn(db, "This week task"));
    await Bun.sleep(1);
    await punchOut(db);

    const results = await punchLog(db, { week: true });

    expect(results).toHaveLength(1);
    expect(results[0]!.taskName).toBe("This week task");
  });

  test("week filter includes Monday entries", async () => {
    const now = new Date();

    // Calculate this week's Monday
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    const dayOfWeek = monday.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(monday.getDate() - daysToMonday);

    // Create entry on Monday
    await db.insert(entries).values({
      taskName: "Monday task",
      project: null,
      startTime: monday,
      endTime: new Date(monday.getTime() + 3600000),
    });

    const results = await punchLog(db, { week: true });

    expect(results.length).toBeGreaterThanOrEqual(1);
    const mondayTask = results.find((r) => r.taskName === "Monday task");
    expect(mondayTask).toBeDefined();
  });

  test("month filter includes entries from start of month", async () => {
    const now = new Date();

    // Create entry from first day of month
    const firstOfMonth = new Date(now);
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);
    await db.insert(entries).values({
      taskName: "Month start task",
      project: null,
      startTime: firstOfMonth,
      endTime: new Date(firstOfMonth.getTime() + 3600000),
    });

    // Create entry from last month
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    await db.insert(entries).values({
      taskName: "Last month task",
      project: null,
      startTime: lastMonth,
      endTime: new Date(lastMonth.getTime() + 3600000),
    });

    const results = await punchLog(db, { month: true });

    const monthStartTask = results.find((r) => r.taskName === "Month start task");
    expect(monthStartTask).toBeDefined();
    const lastMonthTask = results.find((r) => r.taskName === "Last month task");
    expect(lastMonthTask).toBeUndefined();
  });

  test("throws error when multiple time filters provided", async () => {
    expect(async () => {
      await punchLog(db, { today: true, week: true });
    }).toThrow("Only one time filter allowed");

    expect(async () => {
      await punchLog(db, { today: true, month: true });
    }).toThrow("Only one time filter allowed");

    expect(async () => {
      await punchLog(db, { week: true, month: true });
    }).toThrow("Only one time filter allowed");
  });

  test("combines project filter with time filter", async () => {
    // Create entries for different projects today
    await Effect.runPromise(punchIn(db, "Project A task", { project: "project-a" }));
    await Bun.sleep(1);
    await punchOut(db);
    await Effect.runPromise(punchIn(db, "Project B task", { project: "project-b" }));
    await Bun.sleep(1);
    await punchOut(db);

    // Create old project-a entry
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 8);
    await db.insert(entries).values({
      taskName: "Old project A task",
      project: "project-a",
      startTime: lastWeek,
      endTime: new Date(lastWeek.getTime() + 3600000),
    });

    const results = await punchLog(db, { today: true, project: "project-a" });

    expect(results).toHaveLength(1);
    expect(results[0]!.taskName).toBe("Project A task");
    expect(results[0]!.project).toBe("project-a");
  });

  test("returns empty array for non-existent project", async () => {
    await Effect.runPromise(punchIn(db, "Task", { project: "real-project" }));

    const results = await punchLog(db, { project: "fake-project" });

    expect(results).toEqual([]);
  });

  test("includes all required fields in LogEntry", async () => {
    await Effect.runPromise(punchIn(db, "Complete task", { project: "test-project" }));
    await Bun.sleep(1);
    await punchOut(db);

    const results = await punchLog(db);

    expect(results).toHaveLength(1);
    const entry = results[0]!;
    expect(entry.id).toBeDefined();
    expect(entry.taskName).toBe("Complete task");
    expect(entry.project).toBe("test-project");
    expect(entry.startTime).toBeInstanceOf(Date);
    expect(entry.endTime).toBeInstanceOf(Date);
    expect(entry.duration).toBeGreaterThan(0);
    expect(entry.formattedDuration).toBeDefined();
    expect(entry.formattedStart).toBeDefined();
    expect(entry.formattedEnd).toBeDefined();
  });

  test("formatted times use 12-hour format", async () => {
    await Effect.runPromise(punchIn(db, "Task"));
    await Bun.sleep(1);
    await punchOut(db);

    const results = await punchLog(db);

    expect(results).toHaveLength(1);
    // Check that formatted time includes AM or PM
    expect(results[0]!.formattedStart).toMatch(/AM|PM/i);
    expect(results[0]!.formattedEnd).toMatch(/AM|PM/i);
  });
});
