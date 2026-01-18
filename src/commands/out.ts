import { eq, isNull } from "drizzle-orm";
import { entries } from "../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

export async function punchOut(db: BunSQLiteDatabase, options: { at?: string } = {}) {
  // Find active task
  const activeTask = db.select().from(entries).where(isNull(entries.endTime)).limit(1).get();

  if (!activeTask) {
    throw new Error("No active task to stop");
  }

  const endTime = options.at ? parseTime(options.at) : new Date();

  // Validate end time is after start time
  if (endTime <= activeTask.startTime) {
    const timeStr = activeTask.startTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    throw new Error(`End time must be after start time (${timeStr})`);
  }

  const [updated] = await db
    .update(entries)
    .set({ endTime, updatedAt: new Date() })
    .where(eq(entries.id, activeTask.id))
    .returning();

  return updated;
}

function parseTime(timeStr: string): Date {
  // Parse HH:MM format
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid time format: ${timeStr}. Use HH:MM (e.g., 14:30)`);
  }

  const [, hours, minutes] = match;
  const now = new Date();
  now.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  return now;
}
