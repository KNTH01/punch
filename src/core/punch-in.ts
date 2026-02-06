import { Effect } from "effect";
import { isNull } from "drizzle-orm";
import { entries, type Entry } from "../db/schema";
import { TaskAlreadyRunningError } from "./errors";
import { DB } from "~/db";
import { DBError } from "~/db/errors";

export const punchIn = (
  taskName: string,
  options: { project?: string } = {},
): Effect.Effect<Entry, TaskAlreadyRunningError | DBError, DB> =>
  Effect.gen(function* () {
    const db = yield* DB;

    // Check for active task
    const activeTask = yield* Effect.try(() =>
      db.select().from(entries).where(isNull(entries.endTime)).limit(1).get(),
    ).pipe(Effect.mapError((e) => new DBError({ cause: e })));

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
    ).pipe(Effect.mapError((e) => new DBError({ cause: e })));

    if (!entry) {
      return yield* new DBError({
        cause: "Inserting into DB without returning value",
      });
    }

    return entry;
  });
