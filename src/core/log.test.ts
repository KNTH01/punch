import { test, expect, describe } from "bun:test";
import { Cause, Effect } from "effect";
import { DBTest, withDB } from "~/db/test-db";
import { DB } from "~/db";
import { punchIn } from "~/core/punch-in";
import { punchOut } from "~/core/punch-out";
import { punchLog, LogOptionsValidationError } from "~/core/log";
import { entries } from "~/db/schema";

describe("punchLog", () => {
  const runTest = <A, E>(program: Effect.Effect<A, E, DB>) =>
    Effect.runPromise(program.pipe(Effect.provide(DBTest)));

  const runTestExit = <A, E>(program: Effect.Effect<A, E, DB>) =>
    Effect.runPromiseExit(program.pipe(Effect.provide(DBTest)));

  test("shows today's entries by default", async () => {
    const results = await runTest(
      punchIn("Task 1").pipe(
        Effect.andThen(() => Bun.sleep(1)),
        Effect.andThen(() => punchOut()),
        Effect.andThen(() => punchIn("Task 2")),
        Effect.andThen(() => punchLog()),
      ),
    );

    expect(results).toHaveLength(2);
    expect(results[0]!.taskName).toBe("Task 1");
    expect(results[1]!.taskName).toBe("Task 2");
  });

  test("returns empty array when no entries today", async () => {
    const results = await runTest(punchLog());
    expect(results).toEqual([]);
  });

  test("shows active task with null endTime and (active) duration", async () => {
    const results = await runTest(
      punchIn("Active task").pipe(Effect.andThen(() => punchLog())),
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.taskName).toBe("Active task");
    expect(results[0]!.endTime).toBeNull();
    expect(results[0]!.duration).toBeNull();
    expect(results[0]!.formattedDuration).toBe("(active)");
    expect(results[0]!.formattedEnd).toBe("");
  });

  test("filters by project", async () => {
    const results = await runTest(
      punchIn("Task A", { project: "project-a" }).pipe(
        Effect.andThen(() => Bun.sleep(1)),
        Effect.andThen(() => punchOut()),
        Effect.andThen(() => punchIn("Task B", { project: "project-b" })),
        Effect.andThen(() => Bun.sleep(1)),
        Effect.andThen(() => punchOut()),
        Effect.andThen(() => punchIn("Task C", { project: "project-a" })),
        Effect.andThen(() => punchLog({ project: "project-a" })),
      ),
    );

    expect(results).toHaveLength(2);
    expect(results[0]!.taskName).toBe("Task A");
    expect(results[1]!.taskName).toBe("Task C");
    expect(results[0]!.project).toBe("project-a");
    expect(results[1]!.project).toBe("project-a");
  });

  test("returns entries in chronological order", async () => {
    const results = await runTest(
      punchIn("First").pipe(
        Effect.andThen(() => Bun.sleep(1)),
        Effect.andThen(() => punchOut()),
        Effect.andThen(() => Bun.sleep(10)),
        Effect.andThen(() => punchIn("Second")),
        Effect.andThen(() => Bun.sleep(1)),
        Effect.andThen(() => punchOut()),
        Effect.andThen(() => Bun.sleep(10)),
        Effect.andThen(() => punchIn("Third")),
        Effect.andThen(() => punchLog()),
      ),
    );

    expect(results).toHaveLength(3);
    expect(results[0]!.taskName).toBe("First");
    expect(results[1]!.taskName).toBe("Second");
    expect(results[2]!.taskName).toBe("Third");
    expect(results[0]!.startTime.getTime()).toBeLessThan(
      results[1]!.startTime.getTime(),
    );
    expect(results[1]!.startTime.getTime()).toBeLessThan(
      results[2]!.startTime.getTime(),
    );
  });

  test("calculates duration accurately", async () => {
    const results = await runTest(
      punchIn("Timed task").pipe(
        Effect.andThen(() => Bun.sleep(100)),
        Effect.andThen(() => punchOut()),
        Effect.andThen(() => punchLog()),
      ),
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.duration).toBeGreaterThanOrEqual(100);
    expect(results[0]!.duration).toBeLessThan(200);
    expect(results[0]!.endTime).not.toBeNull();
  });

  test("week filter excludes entries older than current week", async () => {
    const now = new Date();
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const results = await runTest(
      withDB((db) => {
        db.insert(entries)
          .values({
            taskName: "Old task",
            project: null,
            startTime: twoWeeksAgo,
            endTime: new Date(twoWeeksAgo.getTime() + 3600000),
          })
          .run();
      }).pipe(
        Effect.andThen(() => punchIn("This week task")),
        Effect.andThen(() => Bun.sleep(1)),
        Effect.andThen(() => punchOut()),
        Effect.andThen(() => punchLog({ week: true })),
      ),
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.taskName).toBe("This week task");
  });

  test("week filter includes Monday entries", async () => {
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    const dayOfWeek = monday.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(monday.getDate() - daysToMonday);

    const results = await runTest(
      withDB((db) => {
        db.insert(entries)
          .values({
            taskName: "Monday task",
            project: null,
            startTime: monday,
            endTime: new Date(monday.getTime() + 3600000),
          })
          .run();
      }).pipe(Effect.andThen(() => punchLog({ week: true }))),
    );

    expect(results.length).toBeGreaterThanOrEqual(1);
    const mondayTask = results.find((r) => r.taskName === "Monday task");
    expect(mondayTask).toBeDefined();
  });

  test("month filter includes entries from start of month", async () => {
    const now = new Date();
    const firstOfMonth = new Date(now);
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const results = await runTest(
      withDB((db) => {
        db.insert(entries)
          .values({
            taskName: "Month start task",
            project: null,
            startTime: firstOfMonth,
            endTime: new Date(firstOfMonth.getTime() + 3600000),
          })
          .run();
        db.insert(entries)
          .values({
            taskName: "Last month task",
            project: null,
            startTime: lastMonth,
            endTime: new Date(lastMonth.getTime() + 3600000),
          })
          .run();
      }).pipe(Effect.andThen(() => punchLog({ month: true }))),
    );

    const monthStartTask = results.find((r) => r.taskName === "Month start task");
    expect(monthStartTask).toBeDefined();
    const lastMonthTask = results.find((r) => r.taskName === "Last month task");
    expect(lastMonthTask).toBeUndefined();
  });

  test("fails with LogOptionsValidationError when multiple time filters", async () => {
    const exit1 = await runTestExit(punchLog({ today: true, week: true }));
    expect(exit1._tag).toBe("Failure");
    if (exit1._tag === "Failure") {
      const error = Cause.failureOption(exit1.cause);
      expect(error._tag).toBe("Some");
      if (error._tag === "Some") {
        expect(error.value).toBeInstanceOf(LogOptionsValidationError);
        expect((error.value as LogOptionsValidationError).filters).toEqual([
          "today",
          "week",
        ]);
      }
    }

    const exit2 = await runTestExit(punchLog({ today: true, month: true }));
    expect(exit2._tag).toBe("Failure");

    const exit3 = await runTestExit(punchLog({ week: true, month: true }));
    expect(exit3._tag).toBe("Failure");
  });

  test("combines project filter with time filter", async () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 8);

    const results = await runTest(
      punchIn("Project A task", { project: "project-a" }).pipe(
        Effect.andThen(() => Bun.sleep(1)),
        Effect.andThen(() => punchOut()),
        Effect.andThen(() => punchIn("Project B task", { project: "project-b" })),
        Effect.andThen(() => Bun.sleep(1)),
        Effect.andThen(() => punchOut()),
        Effect.andThen(() =>
          withDB((db) => {
            db.insert(entries)
              .values({
                taskName: "Old project A task",
                project: "project-a",
                startTime: lastWeek,
                endTime: new Date(lastWeek.getTime() + 3600000),
              })
              .run();
          }),
        ),
        Effect.andThen(() => punchLog({ today: true, project: "project-a" })),
      ),
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.taskName).toBe("Project A task");
    expect(results[0]!.project).toBe("project-a");
  });

  test("returns empty array for non-existent project", async () => {
    const results = await runTest(
      punchIn("Task", { project: "real-project" }).pipe(
        Effect.andThen(() => punchLog({ project: "fake-project" })),
      ),
    );

    expect(results).toEqual([]);
  });

  test("includes all required fields in LogEntry", async () => {
    const results = await runTest(
      punchIn("Complete task", { project: "test-project" }).pipe(
        Effect.andThen(() => Bun.sleep(1)),
        Effect.andThen(() => punchOut()),
        Effect.andThen(() => punchLog()),
      ),
    );

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
    const results = await runTest(
      punchIn("Task").pipe(
        Effect.andThen(() => Bun.sleep(1)),
        Effect.andThen(() => punchOut()),
        Effect.andThen(() => punchLog()),
      ),
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.formattedStart).toMatch(/AM|PM/i);
    expect(results[0]!.formattedEnd).toMatch(/AM|PM/i);
  });
});
