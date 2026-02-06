import { Effect } from "effect";
import { eq, isNull } from "drizzle-orm";
import { entries, type Entry } from "../db/schema";
import { parseTime } from "~/lib/time";
import { InvalidEndTimeError, NoActiveTask } from "./errors";
import { DB } from "~/db";
import { DBError, DBUpdateFailedError } from "~/db/errors";

const findCurrentActiveTask = () =>
  DB.pipe(
    Effect.flatMap((db) =>
      Effect.try(() =>
        db.select().from(entries).where(isNull(entries.endTime)).limit(1).get(),
      ).pipe(Effect.mapError((e) => new DBError({ cause: e }))),
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
        Effect.mapError((e) => new DBError({ cause: e })),
        Effect.flatMap(([updated]) =>
          updated
            ? Effect.succeed(updated)
            : Effect.fail(new DBUpdateFailedError({ id: "unknown" })),
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

export const punchOut = (
  options: { at?: string } = {},
): Effect.Effect<
  Entry,
  NoActiveTask | InvalidEndTimeError | DBError | DBUpdateFailedError,
  DB
> =>
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
