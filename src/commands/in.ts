import { isNull } from "drizzle-orm";
import { entries } from "../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

export async function punchIn(
  db: BunSQLiteDatabase,
  taskName: string,
  options: { project?: string } = {}
) {
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
