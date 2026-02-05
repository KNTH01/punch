import { test, expect, describe } from "bun:test";
import { Cause, Effect } from "effect";
import { eq } from "drizzle-orm";
import { DBTest, withDB } from "~/db/test-db";
import { DB } from "~/db";
import { punchIn } from "~/core/punch-in";
import { punchEdit } from "~/core/edit";
import { entries } from "~/db/schema";
import {
  InvalidEndTimeError,
  EntryNotFoundError,
  AmbiguousIdPrefixError,
  NoEntriesToEditError,
} from "~/core/errors";

describe("punchEdit", () => {
  const runTest = <A, E>(program: Effect.Effect<A, E, DB>) =>
    Effect.runPromise(program.pipe(Effect.provide(DBTest)));

  const runTestExit = <A, E>(program: Effect.Effect<A, E, DB>) =>
    Effect.runPromiseExit(program.pipe(Effect.provide(DBTest)));

  test("edits active task name", async () => {
    const result = await runTest(
      punchIn("Original task").pipe(
        Effect.andThen(() => punchEdit({ taskName: "Updated task" })),
      ),
    );

    expect(result.taskName).toBe("Updated task");
  });

  test("falls back to last entry when no active task", async () => {
    const result = await runTest(
      punchIn("First task").pipe(
        Effect.flatMap((entry) =>
          withDB((db) => {
            const endTime = new Date(entry.startTime);
            endTime.setHours(endTime.getHours() + 1);
            db.update(entries)
              .set({ endTime })
              .where(eq(entries.id, entry.id))
              .run();
            return entry;
          }),
        ),
        Effect.andThen(() => punchEdit({ taskName: "Updated first" })),
      ),
    );

    expect(result.taskName).toBe("Updated first");
  });

  test("edits entry by ID prefix", async () => {
    const result = await runTest(
      punchIn("First task").pipe(
        Effect.flatMap((entry1) =>
          withDB((db) => {
            const endTime = new Date(entry1.startTime);
            endTime.setHours(endTime.getHours() + 1);
            db.update(entries)
              .set({ endTime })
              .where(eq(entries.id, entry1.id))
              .run();
            return entry1;
          }),
        ),
        Effect.flatMap((entry1) =>
          punchIn("Second task").pipe(Effect.map(() => entry1)),
        ),
        Effect.flatMap((entry1) =>
          punchEdit({
            idOrPosition: entry1.id.substring(0, 8),
            taskName: "Updated first",
          }).pipe(Effect.map((updated) => ({ updated, entry1 }))),
        ),
      ),
    );

    expect(result.updated.taskName).toBe("Updated first");
    expect(result.updated.id).toBe(result.entry1.id);
  });

  test("edits entry by position -1", async () => {
    const result = await runTest(
      punchIn("First task").pipe(
        Effect.flatMap((entry1) =>
          withDB((db) => {
            const endTime = new Date(entry1.startTime);
            endTime.setHours(endTime.getHours() + 1);
            db.update(entries)
              .set({
                endTime,
                startTime: new Date(entry1.startTime.getTime() - 3600000),
              })
              .where(eq(entries.id, entry1.id))
              .run();
            return entry1;
          }),
        ),
        Effect.andThen(() => Bun.sleep(10)),
        Effect.andThen(() => punchIn("Second task")),
        Effect.flatMap((entry2) =>
          withDB((db) => {
            const endTime = new Date(entry2.startTime);
            endTime.setHours(endTime.getHours() + 1);
            db.update(entries)
              .set({ endTime })
              .where(eq(entries.id, entry2.id))
              .run();
            return entry2;
          }),
        ),
        Effect.flatMap((entry2) =>
          punchEdit({
            idOrPosition: "-1",
            taskName: "Updated last",
          }).pipe(Effect.map((updated) => ({ updated, entry2 }))),
        ),
      ),
    );

    expect(result.updated.taskName).toBe("Updated last");
    expect(result.updated.id).toBe(result.entry2.id);
  });

  test("edits entry by position -2", async () => {
    const result = await runTest(
      punchIn("First task").pipe(
        Effect.flatMap((entry1) =>
          withDB((db) => {
            const endTime = new Date(entry1.startTime);
            endTime.setHours(endTime.getHours() + 1);
            db.update(entries)
              .set({
                endTime,
                startTime: new Date(entry1.startTime.getTime() - 3600000),
              })
              .where(eq(entries.id, entry1.id))
              .run();
            return entry1;
          }),
        ),
        Effect.andThen(() => Bun.sleep(10)),
        Effect.andThen(() => punchIn("Second task")),
        Effect.flatMap((entry2) =>
          withDB((db) => {
            const endTime = new Date(entry2.startTime);
            endTime.setHours(endTime.getHours() + 1);
            db.update(entries)
              .set({ endTime })
              .where(eq(entries.id, entry2.id))
              .run();
          }),
        ),
        Effect.andThen(() =>
          punchEdit({
            idOrPosition: "-2",
            taskName: "Updated first",
          }),
        ),
      ),
    );

    expect(result.taskName).toBe("Updated first");
  });

  test("updates project", async () => {
    const result = await runTest(
      punchIn("Task", { project: "old-project" }).pipe(
        Effect.andThen(() => punchEdit({ project: "new-project" })),
      ),
    );

    expect(result.project).toBe("new-project");
  });

  test("updates start time", async () => {
    const result = await runTest(
      punchIn("Task").pipe(
        Effect.andThen(() => punchEdit({ start: "14:00" })),
      ),
    );

    expect(result.startTime.getHours()).toBe(14);
    expect(result.startTime.getMinutes()).toBe(0);
  });

  test("fails with InvalidEndTimeError when end before start", async () => {
    const exit = await runTestExit(
      punchIn("Task").pipe(
        Effect.flatMap((entry) =>
          withDB((db) => {
            db.update(entries)
              .set({
                startTime: new Date(2026, 0, 18, 14, 0),
                endTime: new Date(2026, 0, 18, 16, 0),
              })
              .where(eq(entries.id, entry.id))
              .run();
            return entry;
          }),
        ),
        Effect.flatMap((entry) =>
          punchEdit({
            idOrPosition: entry.id.substring(0, 8),
            start: "17:00",
          }),
        ),
      ),
    );

    expect(exit._tag).toBe("Failure");

    if (exit._tag === "Failure") {
      const error = Cause.failureOption(exit.cause);
      expect(error._tag).toBe("Some");
      if (error._tag === "Some") {
        expect(error.value).toBeInstanceOf(InvalidEndTimeError);
      }
    }
  });

  test("fails with EntryNotFoundError for invalid position", async () => {
    const exit = await runTestExit(
      punchIn("Task").pipe(
        Effect.andThen(() => punchEdit({ idOrPosition: "-999" })),
      ),
    );

    expect(exit._tag).toBe("Failure");

    if (exit._tag === "Failure") {
      const error = Cause.failureOption(exit.cause);
      expect(error._tag).toBe("Some");
      if (error._tag === "Some") {
        expect(error.value).toBeInstanceOf(EntryNotFoundError);
        expect((error.value as EntryNotFoundError).identifier).toBe("-999");
      }
    }
  });

  test("fails with EntryNotFoundError for unknown ID prefix", async () => {
    const exit = await runTestExit(
      punchIn("Task").pipe(
        Effect.andThen(() => punchEdit({ idOrPosition: "zzzzzzz" })),
      ),
    );

    expect(exit._tag).toBe("Failure");

    if (exit._tag === "Failure") {
      const error = Cause.failureOption(exit.cause);
      expect(error._tag).toBe("Some");
      if (error._tag === "Some") {
        expect(error.value).toBeInstanceOf(EntryNotFoundError);
      }
    }
  });

  test("fails with AmbiguousIdPrefixError when prefix matches multiple", async () => {
    const exit = await runTestExit(
      withDB((db) => {
        // Insert two entries with same prefix by manually setting IDs
        db.insert(entries)
          .values({
            id: "abc12345-0000-0000-0000-000000000001",
            taskName: "Task 1",
            startTime: new Date(),
            endTime: null,
          })
          .run();
        db.insert(entries)
          .values({
            id: "abc12345-0000-0000-0000-000000000002",
            taskName: "Task 2",
            startTime: new Date(),
            endTime: null,
          })
          .run();
      }).pipe(Effect.andThen(() => punchEdit({ idOrPosition: "abc" }))),
    );

    expect(exit._tag).toBe("Failure");

    if (exit._tag === "Failure") {
      const error = Cause.failureOption(exit.cause);
      expect(error._tag).toBe("Some");
      if (error._tag === "Some") {
        expect(error.value).toBeInstanceOf(AmbiguousIdPrefixError);
        expect((error.value as AmbiguousIdPrefixError).matches).toHaveLength(2);
      }
    }
  });

  test("fails with NoEntriesToEditError when DB is empty", async () => {
    const exit = await runTestExit(punchEdit({ taskName: "New name" }));

    expect(exit._tag).toBe("Failure");

    if (exit._tag === "Failure") {
      const error = Cause.failureOption(exit.cause);
      expect(error._tag).toBe("Some");
      if (error._tag === "Some") {
        expect(error.value).toBeInstanceOf(NoEntriesToEditError);
      }
    }
  });
});
