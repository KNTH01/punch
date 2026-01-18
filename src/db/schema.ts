// NOTE: to generate: bunx drizzle-kit generate --dialect sqlite --schema ./src/db/schema.ts

import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const entries = sqliteTable("entries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskName: text("task_name").notNull(),
  project: text("project"),
  startTime: integer("start_time", { mode: "timestamp_ms" }).notNull(),
  endTime: integer("end_time", { mode: "timestamp_ms" }), // NULL = currently running
  lastActivity: integer("last_activity", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
