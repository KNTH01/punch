# Punch CLI - Next Features

**Date:** 2026-01-18
**Status:** Draft
**Dependencies:** Core commands (in/out/log) complete

## Overview

Implement remaining MVP commands (status, summary, cancel) and design the edit feature for modifying existing entries.

## 1. Status Command

**Purpose:** Show current active task or "No active task"

### Implementation

```typescript
// src/commands/status.ts
export async function status(db: Database) {
  const activeEntry = db
    .select()
    .from(entries)
    .where(isNull(entries.endTime))
    .get();

  if (!activeEntry) {
    console.log("No active task");
    return;
  }

  const elapsed = Date.now() - activeEntry.startTime.getTime();
  const startTimeStr = formatTime(activeEntry.startTime);
  const durationStr = formatDuration(elapsed);

  const projectStr = activeEntry.project ? ` (${activeEntry.project})` : "";

  console.log(
    `Working on '${activeEntry.taskName}'${projectStr} - started ${startTimeStr} (${durationStr} ago)`
  );
}
```

### Output Examples

```bash
$ punch status
Working on 'Fix bug' (acme-app) - started 2:00pm (30m ago)

$ punch status
No active task
```

### Tests

- Shows active task with correct format
- Shows "No active task" when none running
- Handles missing project field
- Duration calculates correctly

## 2. Summary Command

**Purpose:** Aggregate time by project and/or task

### Implementation

```typescript
// src/commands/summary.ts
export async function summary(
  db: Database,
  options: {
    today?: boolean;
    week?: boolean;
    month?: boolean;
    project?: string;
  }
) {
  // 1. Get filtered entries (reuse logic from log command)
  const filteredEntries = getFilteredEntries(db, options);

  // 2. Aggregate by project
  const projectTotals = new Map<string, number>();

  for (const entry of filteredEntries) {
    if (!entry.endTime) continue; // Skip active tasks

    const duration = entry.endTime.getTime() - entry.startTime.getTime();
    const project = entry.project || "(no project)";

    projectTotals.set(
      project,
      (projectTotals.get(project) || 0) + duration
    );
  }

  // 3. Display results
  let total = 0;
  for (const [project, duration] of projectTotals) {
    console.log(`Project: ${project.padEnd(20)} ${formatDuration(duration)}`);
    total += duration;
  }

  console.log("─".repeat(40));
  console.log(`Total: ${" ".repeat(20)} ${formatDuration(total)}`);
}
```

### Output Examples

```bash
$ punch summary --today
Project: acme-app           8h 45m
Project: personal           2h 15m
Project: (no project)       1h 00m
────────────────────────────────────────
Total:                      12h 00m

$ punch summary --week --project acme-app
Project: acme-app           32h 15m
────────────────────────────────────────
Total:                      32h 15m
```

### Additional Features (Optional)

**Task-level breakdown:**
```bash
$ punch summary --today --detailed
Project: acme-app                        8h 45m
  - Fix bug                              2h 30m
  - Code review                          4h 15m
  - Meeting                              2h 00m
Project: personal                        2h 15m
  - Learning Bun                         2h 15m
────────────────────────────────────────
Total:                                  11h 00m
```

### Tests

- Aggregates by project correctly
- Filters work (--today, --week, --month, --project)
- Handles entries without projects
- Skips active tasks (no end time)
- Handles empty results
- Multiple entries same project sum correctly

## 3. Cancel Command

**Purpose:** Delete active entry with confirmation

### Implementation

```typescript
// src/commands/cancel.ts
import { confirm } from "../lib/prompt";

export async function cancel(db: Database) {
  const activeEntry = db
    .select()
    .from(entries)
    .where(isNull(entries.endTime))
    .get();

  if (!activeEntry) {
    console.error("Error: No active task to cancel");
    process.exit(1);
  }

  const projectStr = activeEntry.project ? ` (${activeEntry.project})` : "";
  const confirmed = await confirm(
    `Cancel '${activeEntry.taskName}'${projectStr}?`
  );

  if (!confirmed) {
    console.log("Cancelled");
    return;
  }

  db.delete(entries).where(eq(entries.id, activeEntry.id)).run();

  console.log(`✓ Cancelled '${activeEntry.taskName}'`);
}
```

### Prompt Utility

```typescript
// src/lib/prompt.ts
export async function confirm(message: string): Promise<boolean> {
  process.stdout.write(`${message} [y/N] `);

  const buffer = new Uint8Array(1024);
  const n = await Bun.stdin.read(buffer);

  if (!n) return false;

  const input = new TextDecoder().decode(buffer.subarray(0, n)).trim().toLowerCase();
  return input === "y" || input === "yes";
}
```

### Output Examples

```bash
$ punch cancel
Cancel 'Fix bug' (acme-app)? [y/N] y
✓ Cancelled 'Fix bug'

$ punch cancel
Cancel 'Fix bug'? [y/N] n
Cancelled

$ punch cancel
Error: No active task to cancel
```

### Tests

- Prompts for confirmation
- Deletes entry when confirmed
- Does nothing when not confirmed
- Errors when no active task
- Handles entries with/without projects

## 4. Edit Feature (Brainstorm)

**Purpose:** Modify existing time entries (fix mistakes, adjust times)

### Use Cases

1. **Fix typos:** Wrong task name or project
2. **Adjust times:** Started tracking late / forgot to stop on time
3. **Reassign project:** Tracked under wrong project
4. **Split entries:** Worked on two things but forgot to punch out/in

### Command Design Options

#### Option A: Edit by ID (Simple)

```bash
punch edit <id> [--task "..."] [--project "..."] [--start HH:MM] [--end HH:MM]
```

**Pros:**
- Simple implementation
- Clear which entry to edit
- All fields optional

**Cons:**
- User must know entry ID (from `punch log`)
- Two-step process (log → copy ID → edit)

#### Option B: Edit Recent/Active (Convenience)

```bash
punch edit             # Edit active task (or most recent if none active)
punch edit --last      # Edit last completed entry
punch edit <id>        # Edit by ID
```

**Pros:**
- Common case (edit current/last) is fast
- No need to look up IDs for recent edits

**Cons:**
- More complex logic
- Ambiguous if multiple recent entries

#### Option C: Interactive Selection

```bash
punch edit             # Shows recent entries, pick one to edit
# Displays:
# 1. Fix bug (acme-app) - 2:00pm to 4:30pm (2h 30m)
# 2. Code review (acme-app) - 4:45pm to (active) (15m)
# Which entry? 2
# What to change? [task/project/start/end/done]
```

**Pros:**
- User-friendly, no memorizing IDs
- Guides user through options

**Cons:**
- Requires interactive prompt library
- More complex to test
- Slower for power users

### Recommended Approach: Option A + B Hybrid

```bash
# Quick edits (no ID needed)
punch edit             # Edit active task (or error if none)
punch edit --last      # Edit last completed entry

# Specific edits (requires ID)
punch edit <id> [--task] [--project] [--start] [--end]
```

### Implementation Details

**Schema (no changes needed):**
- `updatedAt` timestamp already exists for tracking modifications

**Validation rules:**
1. Cannot edit non-existent entry
2. `end_time` must be after `start_time`
3. Cannot set `start_time` after current `end_time`
4. `--start`/`--end` accept HH:MM format (parsed to today's date)
5. Update `updatedAt` on any change

**Time parsing:**
- `--start 14:30` → Parse as today 14:30
- `--start 14:30 --date 2026-01-17` → Parse as specific date (future enhancement)
- For now: assume times are from same day as original entry

**Edge cases:**
- Editing active task (endTime = null): allow changing task/project/start
- Editing start time of active task: must be before now
- Multiple active tasks (shouldn't happen, but handle gracefully)

### Examples

```bash
# Fix typo in active task name
$ punch edit --task "Fix authentication bug"
✓ Updated task name

# Forgot to stop on time (stopped at 5pm instead of 4:30pm)
$ punch edit --last --end 16:30
✓ Updated end time to 4:30pm

# Started tracking late (actually started at 2pm not 2:30pm)
$ punch edit <id> --start 14:00
✓ Updated start time to 2:00pm

# Change project assignment
$ punch edit <id> --project acme-v2
✓ Updated project to acme-v2

# Multiple fields at once
$ punch edit <id> --task "Fix bug" --project acme-app --start 14:00 --end 16:30
✓ Updated entry
```

### Testing Strategy

- Edit active task (change task/project/start)
- Edit completed entry (all fields)
- Edit --last flag works
- Validation: end > start
- Validation: active task start < now
- Validation: non-existent ID errors
- updatedAt timestamp changes
- No-op edit (no flags) errors or shows current values

### Open Questions

1. **Date handling:** Should `--start`/`--end` support dates or just times?
   - MVP: Times only (assume same day)
   - Future: Add `--date` flag for cross-day edits

2. **No-flag behavior:** What happens if you run `punch edit` with no flags?
   - Option 1: Error "specify at least one field"
   - Option 2: Show current values (read-only mode)
   - Option 3: Interactive prompt for what to change

3. **Duration conflicts:** What if editing creates overlapping entries?
   - MVP: Allow overlaps (user responsible)
   - Future: Validate no time conflicts

4. **Audit trail:** Should we keep edit history?
   - MVP: No (just updatedAt timestamp)
   - Future: Add `entry_history` table if needed

5. **Delete vs Cancel:** Should edit support deleting completed entries?
   - Separate `punch delete <id>` command?
   - Or `punch edit <id> --delete` flag?
   - For now: cancel only works on active tasks

## Implementation Order

1. **Status command** (simplest, no deps)
2. **Summary command** (reuse filter logic from log)
3. **Cancel command** (requires prompt utility)
4. **Prompt utility** (needed for cancel)
5. **Edit command** (most complex, build on others)

## Success Criteria

- All commands work as specified
- Tests cover happy path + edge cases
- Error messages are clear
- Output formatting matches existing commands
- Edit feature handles time validation correctly

## Notes

- Consider adding colors (green checkmarks, red errors) in future polish pass
- Edit feature can start minimal (Option A) and add convenience flags later
- Prompt utility can grow (yes/no, select from list, text input)
