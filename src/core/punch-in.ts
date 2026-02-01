import { Effect } from "effect";
import { isNull } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { entries, type Entry } from "../db/schema";
import { TaskAlreadyRunningError } from "./errors";

/**
 * Start tracking time for a task.
 *
 * Returns an Effect that:
 * - Succeeds with the created entry
 * - Fails with TaskAlreadyRunningError if a task is already active
 */
export function punchIn(
  db: BunSQLiteDatabase,
  taskName: string,
  options: { project?: string } = {},
): Effect.Effect<Entry, TaskAlreadyRunningError> {
  return Effect.gen(function* () {
    // Check for active task
    const activeTask = db
      .select()
      .from(entries)
      .where(isNull(entries.endTime))
      .limit(1)
      .get();

    if (activeTask) {
      return yield* new TaskAlreadyRunningError({
        taskName: activeTask.taskName,
        startTime: activeTask.startTime,
      });
    }

    const now = new Date();

    const [entry] = yield* Effect.promise(() =>
      db
        .insert(entries)
        .values({
          taskName,
          project: options.project || null,
          startTime: now,
          endTime: null,
        })
        .returning(),
    );

    return entry!;
  });
}
