import { eq, isNull } from "drizzle-orm";
import { entries } from "../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { parseTime } from "../lib/time";

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
