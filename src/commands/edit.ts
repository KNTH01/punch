import { desc, eq, isNull, like } from "drizzle-orm";
import { entries } from "../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { parseTime } from "../lib/time";

export async function punchEdit(
  db: BunSQLiteDatabase,
  options: {
    idOrPosition?: string;
    taskName?: string;
    project?: string;
    start?: string;
    end?: string;
  }
) {
  let entry;

  if (options.idOrPosition) {
    // Check if it's a position reference (-N)
    if (/^-\d+$/.test(options.idOrPosition)) {
      const match = options.idOrPosition.match(/^-(\d+)$/);
      if (!match) {
        throw new Error(`Invalid position format: ${options.idOrPosition}`);
      }
      const [, numStr] = match;
      if (!numStr) {
        throw new Error(`Invalid position format: ${options.idOrPosition}`);
      }
      const num = parseInt(numStr);
      const offset = num - 1;

      entry = db
        .select()
        .from(entries)
        .orderBy(desc(entries.startTime))
        .limit(1)
        .offset(offset)
        .get();

      if (!entry) {
        throw new Error(`No entry found at position ${options.idOrPosition}`);
      }
    } else {
      // ID prefix matching
      const matches = db
        .select()
        .from(entries)
        .where(like(entries.id, `${options.idOrPosition}%`))
        .all();

      if (matches.length === 0) {
        throw new Error(`No entry found with ID prefix '${options.idOrPosition}'`);
      }

      if (matches.length > 1) {
        const idList = matches.map((m) => `  ${m.id}`).join("\n");
        throw new Error(
          `Ambiguous ID prefix '${options.idOrPosition}' matches multiple entries:\n${idList}\n\nUse a longer prefix`
        );
      }

      entry = matches[0];
    }
  } else {
    // Find active task or fall back to last entry
    entry = db.select().from(entries).where(isNull(entries.endTime)).limit(1).get();

    if (!entry) {
      entry = db.select().from(entries).orderBy(desc(entries.startTime)).limit(1).get();
    }
  }

  if (!entry) {
    throw new Error("No entries to edit");
  }

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

  // Validation: end > start when both exist after update
  const finalStartTime = updates.startTime || entry.startTime;
  const finalEndTime = updates.endTime !== undefined ? updates.endTime : entry.endTime;

  if (finalEndTime && finalEndTime <= finalStartTime) {
    const startStr = finalStartTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const endStr = finalEndTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    throw new Error(
      `End time must be after start time (start: ${startStr}, end: ${endStr})`
    );
  }

  const [updated] = await db
    .update(entries)
    .set(updates)
    .where(eq(entries.id, entry.id))
    .returning();

  if (!updated) {
    throw new Error("Failed to update entry");
  }

  return updated;
}
