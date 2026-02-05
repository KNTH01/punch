import { Effect } from "effect";
import { eq, isNull } from "drizzle-orm";
import { entries, type Entry } from "../db/schema";
import { parseTime } from "~/lib/time";
import { InvalidEndTimeError, NoActiveTask, UpdateFailedError } from "./errors";
import { DB } from "~/db";

const findCurrentActiveTask = () =>
  DB.pipe(
    Effect.flatMap((db) =>
      Effect.try(() =>
        db.select().from(entries).where(isNull(entries.endTime)).limit(1).get(),
      ),
    ),
  );

const updateTask = (activeTask: Entry, endTime: Date) =>
  DB.pipe(
    Effect.flatMap((db) =>
      Effect.tryPromise(() =>
        db
          .update(entries)
          .set({ endTime, updatedAt: new Date() })
          .where(eq(entries.id, activeTask.id))
          .returning(),
      ).pipe(
        Effect.flatMap(([updated]) =>
          updated
            ? Effect.succeed(updated)
            : Effect.fail(new UpdateFailedError({ id: "unknown" })),
        ),
      ),
    ),
  );

const validateEndTime = (startTime: Date, endTime: Date) => {
  if (endTime <= startTime) {
    return Effect.fail(new InvalidEndTimeError({ startTime, endTime }));
  }
  return Effect.succeed(endTime);
};

export const punchOut = (options: { at?: string } = {}) =>
  findCurrentActiveTask().pipe(
    Effect.flatMap((activeTask) =>
      activeTask ? Effect.succeed(activeTask) : Effect.fail(new NoActiveTask()),
    ),

    Effect.flatMap((activeTask) => {
      const endTime = options.at ? parseTime(options.at) : new Date();

      return validateEndTime(activeTask.startTime, endTime).pipe(
        Effect.andThen(updateTask(activeTask, endTime)),
      );
    }),
  );
