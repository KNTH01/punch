# Punch CLI - Time Tracker Design

**Date:** 2026-01-18
**Status:** Approved
**Project:** `punch` (codename for CLI time tracker)

## Overview

A feature-rich CLI time tracker built with Bun. The project will eventually evolve into a monorepo with backend + frontend + CLI, but starts as a simple CLI to learn Bun and build core time tracking functionality.

## Goals

- Learn Bun's native APIs and ecosystem
- Build a fast, simple CLI for tracking work time
- Track tasks with project organization
- Future: Monitor computer inactivity to prevent forgotten time entries
- Future: Self-hosted SaaS with paid cloud hosting option

## Tech Stack

- **Runtime:** Bun
- **Database:** SQLite via `bun:sqlite` driver with Drizzle ORM
- **CLI:** Native Bun APIs (no CLI framework)
- **Testing:** `bun:test`
- **Type Safety:** TypeScript with Drizzle schema

### Why Drizzle?

Even though the initial schema is simple (1 table), using Drizzle from the start enables:
- Shared schema across future monorepo packages (cli, backend, frontend)
- Type safety everywhere
- Clean migration management as features evolve
- Still using `bun:sqlite` as the driver (learning Bun)

## Data Model

### Drizzle Schema

Single table to start - simple and effective.

```typescript
// src/db/schema.ts
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const entries = sqliteTable('entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskName: text('task_name').notNull(),
  project: text('project'),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }), // NULL = currently running
  lastActivity: integer('last_activity', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

### Design Decisions

**Active task detection:** Query-based (`WHERE end_time IS NULL`) instead of separate state table.
- Simpler - single source of truth
- Can't get out of sync
- Fast enough with SQLite indexing
- YAGNI - add state table later if actually needed

**No pause/resume:** Just start/stop sessions.
- Clearer mental model: each entry = one continuous work period
- Simpler implementation
- Reports aggregate multiple sessions by task name + project
- If interrupted, just stop and start again

**Project organization:** Tasks belong to projects, tags come later.
- `--project` flag for organization
- Future: Add tags (#work, #personal, #accountability)

## File Locations (XDG Base Directory Spec)

Following Linux conventions:

- **Database:** `$XDG_DATA_HOME/timetrack/timetrack.db` (defaults to `~/.local/share/timetrack/timetrack.db`)
- **Config (future):** `$XDG_CONFIG_HOME/timetrack/config.json` (defaults to `~/.config/timetrack/config.json`)

## CLI Commands

### Command Structure

Primary commands use **punch in/out** metaphor (like punch clock):

```bash
# Core commands
punch in "Task name" [-p project]      # Start tracking time
punch out [-a HH:MM]                    # Stop tracking (optional custom time)
punch status                            # Show current task
punch log [filters...]                  # List time entries
punch summary [filters...]              # Aggregate reports
punch cancel                            # Delete active task

# Aliases
punch start → punch in
punch stop  → punch out
```

### Filters (for log/summary)

```bash
--today, --week, --month               # Time range
--project <name>                        # Filter by project
```

### Command Details

**`punch in "Task" [-p project]`**
- Creates new entry with `start_time = now`, `end_time = null`
- Error if task already running
- Output: `✓ Started "Fix bug" on acme-app at 2:00pm`

**`punch out [-a HH:MM]`**
- Finds active entry (`end_time IS NULL`)
- Sets `end_time = now` (or custom time with `--at`)
- Validates: end time must be after start time
- Output: `✓ Stopped "Fix bug" - worked 2h 30m`

**`punch status`**
- Shows active task or "No active task"
- Output: `Working on 'Fix bug' (acme-app) - started 2:00pm (30m ago)`

**`punch log [filters...]`**
- Lists entries in table format
- Example:
  ```
  ID | Task          | Project  | Start    | End      | Duration
  1  | Fix bug       | acme-app | 2:00pm   | 4:30pm   | 2h 30m
  2  | Code review   | acme-app | 4:45pm   | (active) | 15m
  ```

**`punch summary [filters...]`**
- Aggregates time by project and/or task
- Example:
  ```
  Project: acme-app    8h 45m
  Project: personal    2h 15m
  ─────────────────────────────
  Total:              11h 00m
  ```

**`punch cancel`**
- Deletes active entry
- Confirmation prompt
- Output: `✓ Cancelled "Fix bug"`

## Error Handling & UX

### Error Messages

Clear, actionable errors:

```
Error: Task "Fix bug" is already running (started 2:00pm).
Stop it first with: punch out

Error: No active task to stop.

Error: Invalid time format. Use HH:MM (e.g., 14:30)

Error: End time (2:00pm) is before start time (3:00pm)
```

### Output Formatting

- **Colors:** Green (success), red (errors), yellow (warnings), blue (info)
- **Tables:** Aligned columns for readability
- **Time format:** Human-friendly (2:00pm or 14:00, TBD)
- **Duration:** "2h 30m" not "2.5 hours"
- **Success indicators:** Checkmarks (✓)

## Project Structure

```
src/
├── db/
│   ├── schema.ts          # Drizzle schema definitions
│   ├── index.ts           # DB connection, initialization
│   └── migrations/        # Generated migration files
├── commands/
│   ├── in.ts             # punch in implementation
│   ├── out.ts            # punch out implementation
│   ├── status.ts         # punch status
│   ├── log.ts            # punch log
│   ├── summary.ts        # punch summary
│   └── cancel.ts         # punch cancel
├── lib/
│   ├── idle-detector.ts   # System idle detection (future)
│   ├── prompt.ts          # Interactive prompts/confirmations
│   └── format.ts          # Output formatting utilities
├── cli.ts                 # CLI argument parsing & routing
└── index.ts              # Entry point
```

## Testing Strategy

Use `bun:test` with in-memory SQLite for fast tests:

```typescript
import { test, expect, beforeEach } from "bun:test";

beforeEach(() => {
  db = createDatabase(":memory:");
  runMigrations(db);
});

// Test coverage:
// - punch in: creates entry, prevents duplicate active tasks
// - punch out: stops entry, validates end time
// - punch status: shows active/none correctly
// - punch log: filters work correctly
// - punch summary: aggregates correctly
// - Edge cases: invalid times, missing tasks, etc.
```

## Initial Setup

On first run:

```typescript
// src/db/index.ts
export function initDB() {
  const dataDir = process.env.XDG_DATA_HOME
    ? `${process.env.XDG_DATA_HOME}/timetrack`
    : `${process.env.HOME}/.local/share/timetrack`;

  // Create directory if missing
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = `${dataDir}/timetrack.db`;
  const db = new Database(dbPath);

  // Run Drizzle migrations
  migrate(db);

  return db;
}
```

## package.json Scripts

```json
{
  "scripts": {
    "dev": "bun run src/index.ts",
    "build": "bun build src/index.ts --compile --outfile punch",
    "test": "bun test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

## Future Features (Not in MVP)

### Inactivity Detection
- Monitor system idle time (using `xprintidle` on Linux or command-based tracking)
- Prompt user when idle > threshold: "Stop task at last activity or now?"
- Prevents forgotten time entries

### Edit Command
- `punch edit <id> [--task "..."] [--project "..."] [--start HH:MM] [--end HH:MM]`
- Modify existing entries

### Tags Support
- `punch in "Task" -p project --tags work,urgent`
- Filter by tags in log/summary

### JSON Export
- `punch export [filters...] --json`
- Export time entries for analysis/backup

### Monorepo Evolution
```
packages/
├── cli/          # Current project
├── backend/      # API server (shares db schema)
├── frontend/     # Web UI (shares types)
└── shared/       # Shared Drizzle schema & types
```

## Success Criteria

MVP is successful when:
- Can track time on tasks with projects
- Can view current status and history
- Can generate basic reports
- Database persists correctly
- Error handling is clear and helpful
- Built using Bun's native APIs (learning goal achieved)

## Open Questions

- Time format preference: 12h (2:00pm) vs 24h (14:00)?
- Should `punch log` default to --today or show all entries?
- Confirmation prompts: which commands need them?

## Next Steps

1. Set up project dependencies (Drizzle, drizzle-kit)
2. Implement Drizzle schema and migrations
3. Implement core commands (in, out, status)
4. Implement reporting commands (log, summary)
5. Add tests
6. Polish UX (colors, formatting)
7. Build compiled binary
