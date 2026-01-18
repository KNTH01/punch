import { and, gte, eq } from "drizzle-orm";
import { entries } from "../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { formatTime, formatDuration, type LogEntry } from "../lib/format";

export async function punchLog(
  db: BunSQLiteDatabase,
  options: {
    today?: boolean;
    week?: boolean;
    month?: boolean;
    project?: string;
  } = {}
): Promise<LogEntry[]> {
  // Validate mutually exclusive time filters
  const timeFilters = [options.today, options.week, options.month].filter(Boolean);
  if (timeFilters.length > 1) {
    throw new Error("Only one time filter allowed (today/week/month)");
  }

  // Determine time range (default to today)
  const filterType = options.week ? 'week' : options.month ? 'month' : 'today';
  const { start } = getDateRange(filterType);

  // Build query conditions
  const conditions = [gte(entries.startTime, start)];

  if (options.project) {
    conditions.push(eq(entries.project, options.project));
  }

  // Query entries
  const results = await db
    .select()
    .from(entries)
    .where(and(...conditions))
    .orderBy(entries.startTime)
    .all();

  // Map to LogEntry objects with computed fields
  return results.map(entry => {
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
      formattedEnd: entry.endTime ? formatTime(entry.endTime) : ""
    };
  });
}

/**
 * Get date range boundaries for time filters
 */
function getDateRange(filter: 'today' | 'week' | 'month'): { start: Date } {
  const now = new Date();
  const start = new Date(now);

  switch (filter) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;

    case 'week':
      // Set to Monday 00:00 of current week
      start.setHours(0, 0, 0, 0);
      const dayOfWeek = start.getDay();
      // Handle Sunday (0) - go back 6 days to Monday
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start.setDate(start.getDate() - daysToMonday);
      break;

    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { start };
}
