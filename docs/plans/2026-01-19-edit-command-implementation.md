# Implementation Plan: Punch Edit Command

**Date:** 2026-01-19
**Status:** Ready for Implementation

## Overview

Implement `punch edit` command to modify existing time entries with git-style ID prefix matching, position references, and smart time parsing.

## Command Syntax

```bash
punch edit [<id-or-position>] [task-name] [--flags]
```

**Target selection:**
- No arg: active task or last completed
- Hex prefix: `punch edit a3f7b2c1` (git-style prefix matching)
- Position: `punch edit -1` (last), `punch edit -2` (second to last)

**Arguments:**
- `task-name`: Optional quoted string to rename task
- `--project` / `-p`: Update project
- `--start`: Update start time
- `--end`: Update end time

**Examples:**
```bash
punch edit "new task name"                      # Rename active/last task
punch edit a3f7b2c1 "fix typo"                  # Edit by ID prefix
punch edit -2 --start "14:00" --end "16:30"     # Edit 2nd to last, adjust times
punch edit --project acme-app                   # Change project only
punch edit abc123 "task" --start "1pm" -p foo   # All together
```

## Implementation Steps

### 1. Create Shared Time Parsing Library

**File:** `src/lib/time.ts`

Extract and enhance `parseTime` from `out.ts` to support:
- ISO datetime: `"2026-01-18 14:00"` → full timestamp
- Time only: `"14:00"`, `"2pm"`, `"14h"` → time on baseDate
- Detection: if contains `YYYY-MM-DD` pattern, parse as datetime; else time-only

**Functions:**
- `parseTime(timeStr: string, baseDate?: Date): Date` - main export
- `parseDateTime(str: string): Date` - ISO datetime parser
- `parseTimeOnly(str: string, baseDate: Date): Date` - HH:MM/2pm/14h parser

**Time formats to support:**
- `14:00` - 24-hour format
- `2pm`, `2PM` - 12-hour with meridiem
- `14h` - hour only
- `2026-01-18 14:00` - full datetime

### 2. Update Existing Commands

**File:** `src/commands/out.ts`

Replace local `parseTime` function with import from `lib/time.ts`:
```typescript
import { parseTime } from "../lib/time";
```

### 3. Implement Edit Command

**File:** `src/commands/edit.ts`

**Main function:**
```typescript
export async function punchEdit(
  db: BunSQLiteDatabase,
  options: {
    idOrPosition?: string;
    taskName?: string;
    project?: string;
    start?: string;
    end?: string;
  }
)
```

**Helper functions:**
1. `findTargetEntry(db, idOrPosition?)` - Route to appropriate finder
2. `findByIdPrefix(db, prefix)` - Git-style prefix matching with ambiguity handling
3. `findByPosition(db, position)` - Position reference (-1, -2, etc.)
4. `findDefaultTarget(db)` - Active task or last completed fallback
5. `parseEditArgs(positional: string[])` - Classify positional args as ID/position/task

**ID Prefix Matching:**
- Use Drizzle `like(entries.id, `${prefix}%`)`
- 0 matches: error "No entry found with ID prefix 'xxx'"
- 1 match: proceed
- Multiple matches: error with full UUIDs listed for disambiguation

**Position References:**
- Parse `-N` format, extract offset (N-1)
- Query `orderBy(desc(entries.startTime)).limit(1).offset(offset)`
- Error if out of range

**Default Target:**
1. Try active task: `where(isNull(entries.endTime))`
2. Fall back to last: `orderBy(desc(entries.startTime)).limit(1)`
3. Error if no entries exist

**Update Logic:**
- Build update object conditionally based on provided options
- Parse times relative to entry's original date using `parseTime(timeStr, entry.startTime)`
- Always set `updatedAt: new Date()`
- Use Drizzle: `db.update(entries).set(updates).where(eq(entries.id, id)).returning()`

**Validation:**
- Only hard rule: `end > start` when both exist after update
- No overlap checks, no future date checks - trust user

### 4. Add Router Integration

**File:** `src/index.ts`

**Add to switch statement:**
```typescript
case "edit": {
  const { flags, positional } = parseArgs(process.argv.slice(3));

  // Classify positional args
  let idOrPosition: string | undefined;
  let taskName: string | undefined;

  if (positional.length === 1) {
    const arg = positional[0];
    if (/^-\d+$/.test(arg) || /^[0-9a-f]+$/i.test(arg)) {
      idOrPosition = arg;
    } else {
      taskName = arg;
    }
  } else if (positional.length === 2) {
    idOrPosition = positional[0];
    taskName = positional[1];
  } else if (positional.length > 2) {
    throw new Error("Too many arguments. Usage: punch edit [<id-or-position>] [task-name] [--flags]");
  }

  const options: any = {};
  if (idOrPosition) options.idOrPosition = idOrPosition;
  if (taskName) options.taskName = taskName;
  if (flags.project || flags.p) options.project = flags.project || flags.p;
  if (flags.start) options.start = flags.start;
  if (flags.end) options.end = flags.end;

  const result = await punchEdit(db, options);

  const time = result.startTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const projectPart = result.project ? ` on ${result.project}` : "";
  console.log(`✓ Updated '${result.taskName}'${projectPart} starting at ${time}`);
  break;
}
```

**Update help text:**
```
  edit [<id>] [task]       Edit an entry
    -p, --project <name>   Update project
    --start <time>         Update start time (HH:MM, 2pm, YYYY-MM-DD HH:MM)
    --end <time>           Update end time (HH:MM, 2pm, YYYY-MM-DD HH:MM)
```

### 5. Add Comprehensive Tests

**File:** `src/commands/edit.test.ts`

**Test coverage:**
- Target selection: active, last, by ID, by position, no entries
- ID prefix: exact match, prefix match, ambiguous, not found, invalid chars
- Position: -1, -2, out of range, invalid format
- Field updates: task, project, start, end, multiple fields, unchanged preservation
- Time parsing: HH:MM, 2pm, 14h, ISO datetime, on entry's date, invalid format
- Validation: end > start (pass/fail), allows overlaps/future/active > now
- Argument parsing: all positional combinations, flag combinations, too many args

**Test structure:**
```typescript
describe("punch edit", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  // Test groups: target selection, ID matching, positions,
  // field updates, time parsing, validation, arg parsing
});
```

## Error Messages

```
"No entries to edit"
"Invalid ID prefix: 'xyz'. Must contain only hex characters (0-9, a-f)"
"No entry found with ID prefix 'abc123'"
"Ambiguous ID prefix 'a' matches multiple entries:\n  a1b2...\n  a4b5...\n\nUse a longer prefix"
"No entry found at position -5"
"End time must be after start time (start: 2:00pm, end: 1:00pm)"
"Invalid time format: xyz. Use HH:MM, 2pm, 14h, or YYYY-MM-DD HH:MM"
"Too many arguments. Usage: punch edit [<id-or-position>] [task-name] [--flags]"
```

## Implementation Sequence

1. Create `src/lib/time.ts` with enhanced parsing
2. Update `src/commands/out.ts` to use lib/time
3. Create `src/commands/edit.ts` with all logic
4. Update `src/index.ts` router and help
5. Create `src/commands/edit.test.ts`
6. Run tests and fix issues
7. Manual end-to-end testing

## Critical Files

- `src/commands/edit.ts` - Main command implementation (NEW)
- `src/lib/time.ts` - Shared time parsing utilities (NEW)
- `src/commands/edit.test.ts` - Test suite (NEW)
- `src/index.ts` - Router integration (MODIFY)
- `src/commands/out.ts` - Refactor to use lib/time (MODIFY)
- `src/db/schema.ts` - Reference for entries table structure

## Verification

**Manual testing scenarios:**
```bash
# Setup test data
bun run index.ts in "Task 1" -p project1
bun run index.ts out
bun run index.ts in "Task 2" -p project2

# Test edit commands
bun run index.ts edit "Renamed active task"
bun run index.ts log  # Verify name changed

# Get ID from log output (first 8 chars)
bun run index.ts edit <id-prefix> --start "14:00" --end "16:00"
bun run index.ts log  # Verify times changed

# Test position
bun run index.ts edit -1 "Last task renamed"
bun run index.ts edit -2 --project "new-project"
bun run index.ts log  # Verify changes

# Test validation
bun run index.ts edit -1 --start "16:00" --end "14:00"  # Should error

# Test ambiguous ID (if you have multiple with same prefix)
bun run index.ts edit a  # Should show all matching IDs
```

**Run tests:**
```bash
bun test src/commands/edit.test.ts
bun test  # Run all tests
```

## Future Enhancements (Out of Scope)

- Natural language parsing with chrono-node ("yesterday at 2pm")
- Task-level breakdown in summary command
- Delete command for completed entries
- Audit trail / edit history tracking
