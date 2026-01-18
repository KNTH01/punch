import { isNull } from "drizzle-orm";
import { entries } from "../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { formatTime } from "../lib/format";

export async function punchIn(
  db: BunSQLiteDatabase,
  taskName: string,
  options: { project?: string } = {},
) {
  // Check for active task
  const activeTask = db.select().from(entries).where(isNull(entries.endTime)).limit(1).get();

  if (activeTask) {
    const timeStr = formatTime(activeTask.startTime);
    throw new Error(`Task already running: "${activeTask.taskName}" started at ${timeStr}`);
  }

  const now = new Date();

  const [entry] = await db
    .insert(entries)
    .values({
      taskName,
      project: options.project || null,
      startTime: now,
      endTime: null,
    })
    .returning();

  return entry;
}
