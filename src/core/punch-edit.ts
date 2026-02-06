import { Effect } from "effect";
import { desc, eq, isNull, like } from "drizzle-orm";
import { DB } from "~/db";
import { DBError, DBUpdateFailedError } from "~/db/errors";
import { entries, type Entry } from "~/db/schema";
import { parseTime } from "~/lib/time";
import {
  EntryNotFoundError,
  AmbiguousIdPrefixError,
  NoEntriesToEditError,
  InvalidEndTimeError,
} from "./errors";

export type EditOptions = {
  idOrPosition?: string;
  taskName?: string;
  project?: string;
  start?: string;
  end?: string;
};

/**
 * Find entry by position reference (-1, -2, etc.)
 * Assumes position is already validated by resolveTargetEntry
 */
const findByPosition = (position: string) =>
  Effect.gen(function* () {
    const db = yield* DB;

    const num = parseInt(position.slice(1));
    const offset = num - 1;

    const entry = yield* Effect.try(() =>
      db
        .select()
        .from(entries)
        .orderBy(desc(entries.startTime))
        .limit(1)
        .offset(offset)
        .get(),
    ).pipe(Effect.mapError((e) => new DBError({ cause: e })));

    if (!entry) {
      return yield* new EntryNotFoundError({ identifier: position });
    }

    return entry;
  });

/**
 * Find entry by ID prefix
 */
const findByIdPrefix = (prefix: string) =>
  Effect.gen(function* () {
    const db = yield* DB;

    const matches = yield* Effect.try(() =>
      db
        .select()
        .from(entries)
        .where(like(entries.id, `${prefix}%`))
        .all(),
    ).pipe(Effect.mapError((e) => new DBError({ cause: e })));

    if (matches.length === 0) {
      return yield* new EntryNotFoundError({ identifier: prefix });
    }

    if (matches.length > 1) {
      return yield* new AmbiguousIdPrefixError({
        prefix,
        matches: matches.map((m) => m.id),
      });
    }

    return matches[0] as Entry;
  });

/**
 * Find active task or fall back to last entry
 */
const findActiveOrLast = () =>
  Effect.gen(function* () {
    const db = yield* DB;

    let entry = yield* Effect.try(() =>
      db.select().from(entries).where(isNull(entries.endTime)).limit(1).get(),
    ).pipe(Effect.mapError((e) => new DBError({ cause: e })));

    if (!entry) {
      entry = yield* Effect.try(() =>
        db
          .select()
          .from(entries)
          .orderBy(desc(entries.startTime))
          .limit(1)
          .get(),
      ).pipe(Effect.mapError((e) => new DBError({ cause: e })));
    }

    if (!entry) {
      return yield* new NoEntriesToEditError();
    }

    return entry;
  });

/**
 * Resolve target entry based on idOrPosition option
 */
const resolveTargetEntry = (idOrPosition?: string) => {
  if (!idOrPosition) {
    return findActiveOrLast();
  }

  if (/^-\d+$/.test(idOrPosition)) {
    return findByPosition(idOrPosition);
  }

  return findByIdPrefix(idOrPosition);
};

/**
 * Edit an existing time entry
 */
export const punchEdit = (options: EditOptions = {}) =>
  Effect.gen(function* () {
    const db = yield* DB;

    const entry = yield* resolveTargetEntry(options.idOrPosition);

    // Build updates
    const updates: {
      taskName?: string;
      project?: string;
      startTime?: Date;
      endTime?: Date;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (options.taskName !== undefined) {
      updates.taskName = options.taskName;
    }

    if (options.project !== undefined) {
      updates.project = options.project;
    }

    if (options.start !== undefined) {
      updates.startTime = parseTime(options.start, entry.startTime);
    }

    if (options.end !== undefined) {
      updates.endTime = parseTime(options.end, entry.startTime);
    }

    // Validate time range: end must be after start
    const finalStartTime = updates.startTime || entry.startTime;
    const finalEndTime =
      updates.endTime !== undefined ? updates.endTime : entry.endTime;

    if (finalEndTime && finalEndTime <= finalStartTime) {
      return yield* new InvalidEndTimeError({
        startTime: finalStartTime,
        endTime: finalEndTime,
      });
    }

    // Update DB
    const [updated] = yield* Effect.tryPromise(() =>
      db
        .update(entries)
        .set(updates)
        .where(eq(entries.id, entry.id))
        .returning(),
    ).pipe(Effect.mapError((e) => new DBError({ cause: e })));

    if (!updated) {
      return yield* new DBUpdateFailedError({ id: entry.id });
    }

    return updated;
  });
