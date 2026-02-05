import { Effect } from "effect";
import { isNull } from "drizzle-orm";
import { entries } from "../db/schema";
import { TaskAlreadyRunningError } from "./errors";
import { DB } from "~/db";

export const punchIn = (taskName: string, options: { project?: string } = {}) =>
  Effect.gen(function* () {
    const db = yield* DB;

    // Check for active task
    const activeTask = yield* Effect.try(() =>
      db.select().from(entries).where(isNull(entries.endTime)).limit(1).get(),
    );

    if (activeTask) {
      return yield* new TaskAlreadyRunningError({
        taskName: activeTask.taskName,
        startTime: activeTask.startTime,
      });
    }

    const now = new Date();

    const [entry] = yield* Effect.tryPromise(() =>
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

    return entry;
  });
