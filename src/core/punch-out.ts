import { Effect } from "effect";
import { eq, isNull } from "drizzle-orm";
import { entries, type Entry } from "../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { parseTime } from "~/lib/time";
import { InvalidEndTimeError, NoActiveTask, UpdateFailedError } from "./errors";

const findCurrentActiveTask = (db: BunSQLiteDatabase) =>
  Effect.sync(() =>
    db.select().from(entries).where(isNull(entries.endTime)).limit(1).get(),
  );

const updateTask = (db: BunSQLiteDatabase, activeTask: Entry, endTime: Date) =>
  Effect.promise(() =>
    db
      .update(entries)
      .set({ endTime, updatedAt: new Date() })
      .where(eq(entries.id, activeTask.id))
      .returning(),
  );

const validateEndTime = (
  startTime: Date,
  endTime: Date,
): Effect.Effect<Date, InvalidEndTimeError> => {
  if (endTime <= startTime) {
    return Effect.fail(new InvalidEndTimeError({ startTime, endTime }));
  }
  return Effect.succeed(endTime);
};

export const punchOut = (
  db: BunSQLiteDatabase,
  options: { at?: string } = {},
): Effect.Effect<
  Entry,
  NoActiveTask | InvalidEndTimeError | UpdateFailedError
> =>
  findCurrentActiveTask(db).pipe(
    Effect.flatMap(
      (
        activeTask,
      ): Effect.Effect<Entry[], NoActiveTask | InvalidEndTimeError> => {
        if (!activeTask) {
          return Effect.fail(new NoActiveTask());
        }

        const endTime = options.at ? parseTime(options.at) : new Date();

        return validateEndTime(activeTask.startTime, endTime).pipe(
          Effect.andThen(() => updateTask(db, activeTask, endTime)),
        );
      },
    ),
    Effect.flatMap(([updated]) =>
      updated
        ? Effect.succeed(updated)
        : Effect.fail(new UpdateFailedError({ id: "unknown" })),
    ),
  );
