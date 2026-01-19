# Session: Edit Command Implementation

**Date:** 2026-01-19
**Focus:** Implement `punch edit` command with TDD approach

## Summary

Successfully implemented the `punch edit` command using Test-Driven Development, plus added ID column to log output for easier entry identification.

## What Was Built

### 1. Shared Time Parsing Library (`src/lib/time.ts`)

**Purpose:** Centralized time parsing for all commands

**Features:**
- Multiple time format support:
  - `14:30` - 24-hour HH:MM
  - `2pm`, `2PM` - 12-hour with meridiem
  - `14h` - hour-only format
  - `2026-01-18 14:30` - full ISO datetime
- `baseDate` parameter for relative time parsing
- Auto-detection: datetime vs time-only based on pattern

**Tests:** 9 tests in `src/lib/time.test.ts`
- HH:MM format
- 12-hour am/pm (including 12am/12pm edge cases)
- Hour-only format
- ISO datetime
- baseDate application
- Error handling

**Refactoring:** Updated `src/commands/out.ts` to use shared library

### 2. Edit Command (`src/commands/edit.ts`)

**Syntax:**
```bash
punch edit [<id-or-position>] [task-name] [--flags]
```

**Target Selection:**
- No args: active task or last completed (fallback)
- ID prefix: `punch edit a3f7b2c1` (git-style matching)
- Position: `punch edit -1` (last), `punch edit -2` (second to last)

**Field Updates:**
- `--project` / `-p`: Update project
- `--start <time>`: Update start time
- `--end <time>`: Update end time
- Positional task name: Rename task

**Implementation Details:**
- `findTargetEntry()`: Routes to appropriate finder
- `findByIdPrefix()`: Git-style prefix matching with ambiguity detection
- `findByPosition()`: Position reference (-N format)
- `findDefaultTarget()`: Active task with last-entry fallback
- Time parsing relative to entry's original date
- Validation: end > start (only hard rule - trusts user otherwise)

**Tests:** 8 tests in `src/commands/edit.test.ts`
- Default target (active task)
- Fallback to last entry
- ID prefix matching
- Position references (-1, -2)
- Project updates
- Start time updates
- End time validation
- TypeScript strict mode compliance

### 3. Router Integration (`src/index.ts`)

**Added:**
- Edit command case with full argument parsing
- Position reference handling (-N format requires special parsing)
- Help text with usage examples

**Help Text:**
```
edit [<id>] [task]       Edit an entry
  -p, --project <name>   Update project
  --start <time>         Update start time (HH:MM, 2pm, YYYY-MM-DD HH:MM)
  --end <time>           Update end time (HH:MM, 2pm, YYYY-MM-DD HH:MM)
```

### 4. ID Column in Log Output (`src/lib/format.ts`)

**Change:** Added ID column showing first 8 characters of entry UUID

**Before:**
```
Task    | Project  | Start    | End      | Duration
```

**After:**
```
ID       | Task    | Project  | Start    | End      | Duration
4996c400 | working | punch    | 12:29 AM | 1:48 AM | 1h 19m
```

**Purpose:** Makes ID prefix matching easier for edit command

## Examples Verified

```bash
# Rename active/last task
punch edit "new task name"

# Edit by ID prefix
punch edit a3f7b2c1 "fix typo"

# Edit by position
punch edit -2 --start "14:00" --end "16:30"

# Change project only
punch edit --project acme-app

# Multiple updates
punch edit abc123 "task" --start "1pm" -p foo
```

## Test Results

**Overall:** 56/57 tests passing
- All new tests passing (17 new tests)
- 1 pre-existing failure (unrelated async test syntax in `out.test.ts`)
- TypeScript strict mode: ✓ No errors

**New test files:**
- `src/lib/time.test.ts` - 9 tests
- `src/commands/edit.test.ts` - 8 tests

## What's NOT Done (Missing from Plan)

### Hex Character Validation for ID Prefixes

**Missing:** The plan specified validating that ID prefixes contain only hex characters before querying:

```typescript
// Planned but NOT implemented:
if (!/^[0-9a-f]+$/i.test(prefix)) {
  throw new Error(
    `Invalid ID prefix: '${prefix}'. Must contain only hex characters (0-9, a-f)`
  );
}
```

**Current behavior:** Any prefix is accepted and passed to SQL LIKE query

**Impact:** Low (SQL LIKE will just not match), but plan specified this validation

**Test missing:** Test for invalid hex characters in ID prefix

### Suggested Next Steps

1. **Add hex validation:** Update `findByIdPrefix()` in `src/commands/edit.ts`
2. **Add test:** Test invalid ID prefix characters
3. **Fix pre-existing test:** `out.test.ts` line 52-54 (async test syntax)
4. **Consider adding:**
   - `punch delete <id>` command
   - Edit history/audit trail
   - Natural language time parsing ("yesterday at 2pm")

## Files Created

- `src/lib/time.ts` - Time parsing library
- `src/lib/time.test.ts` - Time parsing tests
- `src/commands/edit.ts` - Edit command implementation
- `src/commands/edit.test.ts` - Edit command tests
- `docs/sessions/2026-01-19-edit-command-implementation.md` - This file

## Files Modified

- `src/commands/out.ts` - Refactored to use shared time library
- `src/index.ts` - Added edit command routing and help text
- `src/lib/format.ts` - Added ID column to log table output

## Technical Notes

### TDD Approach

This implementation followed strict TDD:
1. Deleted initial implementation code when realized tests weren't written first
2. Red-Green-Refactor cycle for each feature
3. Watched every test fail before implementing
4. TypeScript strict mode compliance throughout

### Position Reference Parsing Challenge

Position references like `-1` are tricky because the arg parser treats them as flags. Solution: Special handling in router to detect `-\d+` pattern before general flag parsing.

### Time Parsing Design Decision

Times are parsed relative to the entry's original date (not current date). This allows editing historical entries without accidentally moving them to today.

Example:
```typescript
// Entry from 2026-01-18
parseTime("14:00", entry.startTime) // Returns 2026-01-18 14:00, not today
```

## Session Stats

- Duration: ~2 hours
- Tests written: 17
- Tests passing: 56/57
- Lines of code: ~500
- Files created: 4
- Files modified: 3

---

## What to Do Next Session

### Immediate (Complete Edit Feature)

1. **Add hex validation for ID prefixes**
   - Location: `src/commands/edit.ts` in `findByIdPrefix()`
   - Add regex check: `/^[0-9a-f]+$/i`
   - Error message: `Invalid ID prefix: 'xyz'. Must contain only hex characters (0-9, a-f)`
   - Add test case in `src/commands/edit.test.ts`

2. **Fix pre-existing test failure**
   - Location: `src/commands/out.test.ts:52-54`
   - Issue: Async test syntax - `expect(async () => ...)` should use `rejects`
   - Current: 56/57 tests passing

### Short-term (Feature Parity)

3. **Implement `punch delete` command**
   - Delete completed entries by ID/position
   - Safety: Confirm before delete
   - Prevent deleting active tasks

4. **Implement `punch cancel` command**
   - Delete currently active task
   - Confirm before canceling

5. **Implement `punch status` command**
   - Show active task with duration
   - Project info if set

### Medium-term (Polish)

6. **Better error messages**
   - Suggest longer prefix when ID is ambiguous
   - Show available IDs in helpful format

7. **Natural language time parsing**
   - Install chrono-node or similar
   - Support "yesterday at 2pm", "last Friday"
   - Falls back to current parsing

8. **Audit trail for edits**
   - Track who/when entries were edited
   - Show edit history

### Long-term (Advanced Features)

9. **Task-level breakdown in summary**
   - Group by task across projects
   - Show total time per task

10. **Export functionality**
    - CSV export for time entries
    - Filter by date range/project

11. **Sync backend**
    - Design API for cloud sync
    - Multi-device support

### Code Quality

- All features should use TDD (test-driven development)
- Maintain TypeScript strict mode compliance
- Keep test coverage high
- Follow existing patterns for commands
