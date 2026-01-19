# Punch Commands Reference

Complete reference for all Punch CLI commands with examples and detailed behavior.

## Command Syntax

```bash
punch <command> [arguments] [flags]
```

## Commands

- [punch in](#punch-in) - Start tracking time
- [punch out](#punch-out) - Stop tracking time
- [punch log](#punch-log) - List time entries
- [punch edit](#punch-edit) - Modify entries

---

## punch in

Start tracking time on a task.

### Syntax

```bash
punch in <task-name> [-p|--project <name>]
```

### Arguments

- `task-name` - Task description (required, quoted if contains spaces)

### Flags

- `-p, --project <name>` - Project name (optional)

### Examples

```bash
# Basic task
punch in "Fix authentication bug"

# Task with project
punch in "Code review" -p acme-app
punch in "Learning Bun" --project personal

# Short project name
punch in "Meeting" -p acme
```

### Output

```
✓ Started 'Fix authentication bug' on acme-app at 2:00 PM
✓ Started 'Learning Bun' at 2:00 PM
```

### Behavior

- Creates new entry with `start_time = now`, `end_time = null`
- Uses UUID primary key (e.g., `a3f7b2c1-...`)
- Errors if task already running (only one active task allowed)
- Project is optional (can track tasks without projects)

### Error Messages

```
Error: A task is already running: 'Previous task' (started 2:00 PM)
Stop it first with: punch out
```

---

## punch out

Stop tracking the current active task.

### Syntax

```bash
punch out [-a|--at <time>]
```

### Flags

- `-a, --at <time>` - Custom end time (optional, defaults to now)

### Time Formats

- `14:30` - 24-hour HH:MM format
- `2pm`, `2PM` - 12-hour with meridiem
- `14h` - Hour-only (assumes :00 minutes)
- `2026-01-18 14:30` - Full ISO datetime

### Examples

```bash
# Stop now
punch out

# Stop at specific time (backdated)
punch out -a 16:30          # 4:30 PM
punch out --at 2pm          # 2:00 PM
punch out -a 14h            # 2:00 PM (hour only)
```

### Output

```
✓ Stopped 'Fix authentication bug' - worked 2h 30m
✓ Stopped 'Code review' - worked 45m
```

### Behavior

- Finds active entry (`end_time IS NULL`)
- Sets `end_time = now` (or custom time with `--at`)
- Calculates and displays duration
- Validates: end time must be after start time

### Validation

```bash
# This will error:
punch in "Task" -a 14:00    # Started at 2:00 PM
punch out -a 13:00          # Trying to end at 1:00 PM (before start)

# Error message:
Error: End time must be after start time (2:00 PM)
```

### Error Messages

```
Error: No active task to stop
Error: End time must be after start time (2:00 PM)
Error: Invalid time format: xyz. Use HH:MM, 2pm, 14h, or YYYY-MM-DD HH:MM
```

---

## punch log

List time entries in table format with filtering options.

### Syntax

```bash
punch log [--today|--week|--month] [--project <name>]
```

### Flags

- `--today` - Show today's entries only
- `--week` - Show this week's entries
- `--month` - Show this month's entries
- `--project <name>` - Filter by project name

### Examples

```bash
# All entries
punch log

# Filter by time range
punch log --today
punch log --week
punch log --month

# Filter by project
punch log --project acme-app
punch log -p personal

# Combine filters
punch log --week --project acme-app
```

### Output

```
ID       | Task                    | Project  | Start    | End      | Duration
4996c400 | Fix authentication bug  | acme-app | 2:00 PM  | 4:30 PM  | 2h 30m
a3f7b2c1 | Code review            | acme-app | 4:45 PM  | 5:30 PM  | 45m
b7e9d123 | Learning Bun           | personal | 6:00 PM  | (active) | 1h 15m
c8f2a456 | Meeting                |          | 1:00 PM  | 2:00 PM  | 1h 0m
```

### ID Column

The ID column shows the first 8 characters of the entry's UUID. Use this prefix with `punch edit` to modify entries:

```bash
punch edit 4996c400 "Fixed authentication bug"
```

### Active Entries

Active entries (still running) show:
- `(active)` in the End column
- Elapsed time in Duration column (calculated from start to now)

### Empty Project

Entries without a project show an empty cell in the Project column.

### Behavior

- Sorted by start time (newest first by default)
- Shows all entries if no filters specified
- Combines filters with AND logic
- Empty result displays "No entries found"

---

## punch edit

Modify existing time entries with flexible targeting and field updates.

### Syntax

```bash
punch edit [<id-or-position>] [task-name] [--flags]
```

### Target Selection

**No arguments:** Edit active task, or last completed if no active task

```bash
punch edit "New task name"
punch edit --project new-project
```

**ID prefix:** Git-style prefix matching (get ID from `punch log`)

```bash
punch edit a3f7b2c1 "Fix typo in task name"
punch edit 4996 --start "14:00"
```

**Position reference:** Relative position from most recent

```bash
punch edit -1 "Last entry"          # Last entry (most recent)
punch edit -2 --start "14:00"       # Second to last
punch edit -3 --project acme-app    # Third to last
```

### Arguments

- `task-name` - New task name (optional, quoted if contains spaces)

### Flags

- `-p, --project <name>` - Update project
- `--start <time>` - Update start time
- `--end <time>` - Update end time

### Time Formats

Same as `punch out`:
- `14:30` - 24-hour HH:MM
- `2pm`, `2PM` - 12-hour with meridiem
- `14h` - Hour-only
- `2026-01-18 14:30` - Full ISO datetime

**Important:** Times are parsed relative to the entry's original date, not today.

### Examples

```bash
# Rename active/last task
punch edit "New task name"

# Edit by ID prefix (from punch log)
punch edit a3f7b2c1 "Fixed authentication bug"
punch edit 4996c400 --project acme-v2

# Edit by position
punch edit -1 --start "14:00" --end "16:30"
punch edit -2 "Yesterday's task"
punch edit -3 --project personal

# Change project only
punch edit --project acme-app
punch edit -1 -p new-project

# Multiple fields at once
punch edit abc123 "Complete rewrite" --start "1pm" --end "5pm" -p acme-app

# Just adjust times
punch edit --start "14:00"              # Active/last entry
punch edit 4996 --end "16:30"          # Specific entry
```

### Output

```
✓ Updated 'Fixed authentication bug' on acme-app starting at 2:00 PM
✓ Updated 'New task name' starting at 2:00 PM
```

### ID Prefix Matching

**Exact match:** Uses full UUID if provided
```bash
punch edit a3f7b2c1-8d4e-4f23-9a1b-c5d6e7f8a9b0 "Task"
```

**Prefix match:** Matches any entry starting with prefix
```bash
punch edit a3f "Task"          # Matches a3f7b2c1-...
punch edit a3f7b2c1 "Task"     # Matches a3f7b2c1-...
```

**Ambiguous prefix:** Errors if multiple entries match
```bash
punch edit a "Task"            # If multiple entries start with 'a'

# Error message:
Error: Ambiguous ID prefix 'a' matches multiple entries:
  a3f7b2c1-8d4e-4f23-9a1b-c5d6e7f8a9b0
  a4b8c9d2-1e5f-4a67-8b2c-d3e4f5a6b7c8

Use a longer prefix to uniquely identify the entry
```

**Not found:** Errors if no entries match
```bash
punch edit xyz123 "Task"

# Error message:
Error: No entry found with ID prefix 'xyz123'
```

### Position References

Position numbers are negative integers counting back from most recent:
- `-1` = last entry (most recent)
- `-2` = second to last
- `-3` = third to last
- etc.

```bash
# View entries
punch log
# ID       | Task        | Start
# 4996c400 | Task C      | 6:00 PM  ← position -1 (last)
# a3f7b2c1 | Task B      | 4:00 PM  ← position -2
# b7e9d123 | Task A      | 2:00 PM  ← position -3

punch edit -1 "Task C updated"    # Edits most recent
punch edit -2 "Task B updated"    # Edits second to last
punch edit -3 "Task A updated"    # Edits third to last
```

**Out of range:** Errors if position doesn't exist
```bash
punch edit -10 "Task"    # If only 5 entries exist

# Error message:
Error: No entry found at position -10
```

### Default Target Behavior

When no ID or position is specified, edit command targets:

1. **Active task first:** If a task is currently running (`end_time IS NULL`)
```bash
punch in "Active task"
punch edit "Renamed active task"    # Edits the running task
```

2. **Last entry fallback:** If no active task, edits most recent completed entry
```bash
punch out
punch edit "Renamed last entry"     # Edits last completed
```

3. **No entries:** Errors if database is empty
```bash
# Empty database
punch edit "Task"

# Error message:
Error: No entries to edit
```

### Time Parsing Details

Times are parsed **relative to the entry's original date**, not today:

```bash
# Entry from 2026-01-18 14:00 - 16:00
punch edit <id> --start "15:00"    # Changes to 2026-01-18 15:00 (not today!)
```

This prevents accidentally moving historical entries to today's date.

For full datetime changes, use ISO format:
```bash
punch edit <id> --start "2026-01-17 14:00"    # Explicit date change
```

### Validation Rules

**Only hard rule:** End time must be after start time

```bash
# This will error:
punch edit -1 --start "16:00" --end "14:00"

# Error message:
Error: End time must be after start time (start: 4:00 PM, end: 2:00 PM)
```

**What's NOT validated (trusts user):**
- Overlapping entries (multiple tasks same time)
- Future timestamps (start/end in the future)
- Active task with start time after now
- Gaps between entries

### Field Updates

**Task name:** Positional argument (must be quoted if contains spaces)
```bash
punch edit "New task name"
punch edit <id> "New name"
```

**Project:** Use `-p` or `--project` flag
```bash
punch edit --project new-project
punch edit <id> -p acme-app
```

**Start time:** Use `--start` flag
```bash
punch edit --start "14:00"
punch edit <id> --start "2pm"
```

**End time:** Use `--end` flag
```bash
punch edit --end "16:30"
punch edit <id> --end "4:30pm"
```

**Multiple fields:** Combine any flags
```bash
punch edit <id> "New name" --start "14:00" --end "16:00" -p project
```

### Unchanged Fields

Fields not specified in the command remain unchanged:

```bash
# Original entry:
# Task: "Fix bug"
# Project: acme-app
# Start: 2:00 PM
# End: 4:00 PM

punch edit <id> --start "14:30"

# Result:
# Task: "Fix bug"           ← unchanged
# Project: acme-app          ← unchanged
# Start: 2:30 PM             ← changed
# End: 4:00 PM               ← unchanged
```

### Updated Timestamp

Every edit updates the `updatedAt` timestamp automatically for audit trail.

### Error Messages

```
Error: No entries to edit
Error: No entry found with ID prefix 'abc123'
Error: Ambiguous ID prefix 'a' matches multiple entries:
  a3f7b2c1-...
  a4b8c9d2-...
Use a longer prefix
Error: No entry found at position -5
Error: End time must be after start time (start: 2:00 PM, end: 1:00 PM)
Error: Invalid time format: xyz. Use HH:MM, 2pm, 14h, or YYYY-MM-DD HH:MM
```

---

## Common Workflows

### Basic Time Tracking

```bash
# Start work
punch in "Morning standup" -p acme-app

# Stop work
punch out

# Continue different task
punch in "Code review" -p acme-app
punch out

# View today's work
punch log --today
```

### Fixing Mistakes

```bash
# Typo in task name
punch edit "Correct task name"

# Forgot to stop on time
punch edit --end "16:30"

# Started tracking late
punch edit --start "14:00"

# Wrong project
punch edit --project correct-project
```

### Reviewing Past Work

```bash
# This week's entries
punch log --week

# Specific project
punch log --project acme-app

# Edit yesterday's entry (find ID from log)
punch log --week
punch edit a3f7b2c1 "Updated task name"

# Or use position
punch edit -2 --project personal
```

### Backdating Entries

```bash
# Forgot to track earlier work
punch in "Earlier task" -p acme-app
punch edit --start "14:00" --end "16:00"
```

---

## Tips

**Use ID prefixes:** Copy first few characters from `punch log` output
```bash
punch log
# ID: 4996c400-...
punch edit 4996 "New name"    # Just need prefix
```

**Position shortcuts:** Use negative numbers for recent entries
```bash
punch edit -1    # Last entry
punch edit -2    # Second to last
```

**Time formats:** Use whatever's convenient
```bash
punch out -a 16:30    # 24-hour
punch out -a 4:30pm   # 12-hour
punch out -a 16h      # Hour only (16:00)
```

**No-arg edit:** Quick edits to active/last task
```bash
punch edit "Quick rename"           # No ID needed
punch edit --project new-project    # Change project
```
