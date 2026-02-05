import { and, gte, eq } from "drizzle-orm";
import { Data, Effect } from "effect";
import { DB } from "~/db";
import { DBError } from "~/db/errors";
import { entries } from "~/db/schema";
import { formatTime, formatDuration } from "~/lib/format";

export type LogEntry = {
  id: string;
  taskName: string;
  project: string | null;
  startTime: Date;
  endTime: Date | null;
  duration: number | null;
  formattedDuration: string;
  formattedStart: string;
  formattedEnd: string;
};

type LogOptions = {
  today?: boolean;
  week?: boolean;
  month?: boolean;
  project?: string;
};

class LogOptionsValidationError extends Data.TaggedError(
  "LogOptionsValidationError",
)<{ options: LogOptions }> {}

const validateLogOptions = (options: LogOptions) => {
  // Validate mutually exclusive time filters
  const timeFilters = [options.today, options.week, options.month].filter(
    Boolean,
  );

  if (timeFilters.length > 1) {
    return Effect.fail(new LogOptionsValidationError({ options }));
  }

  return Effect.succeed(options);
};

export const punchLog = (options: LogOptions) =>
  Effect.gen(function* () {
    const db = yield* DB;

    options = yield* validateLogOptions(options);

    // Determine time range (default to today)
    const filterType = options.week
      ? "week"
      : options.month
        ? "month"
        : "today";

    const { start } = getDateRange(filterType);

    // Build query conditions
    const conditions = [gte(entries.startTime, start)];
    if (options.project) {
      conditions.push(eq(entries.project, options.project));
    }

    // Query entries
    const results = yield* Effect.try(() =>
      db
        .select()
        .from(entries)
        .where(and(...conditions))
        .orderBy(entries.startTime)
        .all(),
    ).pipe(Effect.mapError((e) => new DBError({ cause: e })));

    // Map to LogEntry objects with computed fields
    return results.map((entry) => {
      const duration = entry.endTime
        ? entry.endTime.getTime() - entry.startTime.getTime()
        : null;

      return {
        id: entry.id,
        taskName: entry.taskName,
        project: entry.project,
        startTime: entry.startTime,
        endTime: entry.endTime,
        duration,
        formattedDuration: formatDuration(entry.startTime, entry.endTime),
        formattedStart: formatTime(entry.startTime),
        formattedEnd: entry.endTime ? formatTime(entry.endTime) : "",
      };
    });
  });

/**
 * Get date range boundaries for time filters
 */
function getDateRange(filter: "today" | "week" | "month"): { start: Date } {
  const now = new Date();
  const start = new Date(now);

  switch (filter) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;

    case "week":
      // Set to Monday 00:00 of current week
      start.setHours(0, 0, 0, 0);
      const dayOfWeek = start.getDay();
      // Handle Sunday (0) - go back 6 days to Monday
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start.setDate(start.getDate() - daysToMonday);
      break;

    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { start };
}
