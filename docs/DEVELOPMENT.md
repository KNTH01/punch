# Development Status & Guide

Current development status, testing information, and contributor guide for Punch CLI.

## Current Status (v0.1)

**Last Updated:** 2026-01-19

### Implemented Commands

- ✅ **punch in** - Start tracking time (8 tests)
- ✅ **punch out** - Stop tracking with custom time support (4 tests)
- ✅ **punch log** - List entries with filtering (7 tests)
- ✅ **punch edit** - Modify entries with git-style ID matching (8 tests)

### Planned Commands (v0.2)

- ⏳ **punch status** - Show current active task with duration
- ⏳ **punch summary** - Aggregate reports by project/task
- ⏳ **punch cancel** - Delete active task with confirmation
- ⏳ **punch delete** - Remove completed entries

### Test Status

**Overall:** 56/57 tests passing (98.2%)

**Test Breakdown:**
- `src/commands/in.test.ts` - 8/8 passing
- `src/commands/out.test.ts` - 3/4 passing (1 known failure)
- `src/commands/log.test.ts` - 7/7 passing
- `src/commands/edit.test.ts` - 8/8 passing
- `src/lib/time.test.ts` - 9/9 passing
- `src/lib/format.test.ts` - 21/21 passing

**Known Issues:**
- `out.test.ts:36` - Async test syntax issue (pre-existing, unrelated to new features)

### Type Safety

✅ TypeScript strict mode enabled - 0 errors

### Recent Changes

**2026-01-19: Edit Command Implementation**
- Implemented `punch edit` with TDD approach
- Added git-style ID prefix matching
- Added position references (-1, -2, etc.)
- Created shared time parsing library (`src/lib/time.ts`)
- Added ID column to log output for easier editing
- 17 new tests added (all passing)
- Refactored `out.ts` to use shared time library

See `docs/sessions/2026-01-19-edit-command-implementation.md` for details.

## Development Setup

### Prerequisites

- Bun 1.3.6 or later
- Git

### Installation

```bash
# Clone repository
git clone <repo-url>
cd punch

# Install dependencies
bun install

# Run migrations
bun run migrate

# Run tests
bun test

# Run type checks
bun run typecheck
```

### Project Structure

```
src/
├── db/
│   ├── schema.ts          # Drizzle schema (1 table: entries)
│   ├── index.ts           # DB connection & initialization
│   └── test-db.ts         # In-memory SQLite for tests
├── commands/
│   ├── in.ts / in.test.ts           # Start tracking
│   ├── out.ts / out.test.ts         # Stop tracking
│   ├── log.ts / log.test.ts         # List entries
│   └── edit.ts / edit.test.ts       # Modify entries
├── lib/
│   ├── time.ts / time.test.ts       # Time parsing utilities
│   └── format.ts / format.test.ts   # Output formatting
└── index.ts                          # CLI router & help

docs/
├── OVERVIEW.md            # Project vision & architecture
├── COMMANDS.md            # Complete command reference
├── DEVELOPMENT.md         # This file
├── plans/                 # Design documents
│   ├── 2026-01-18-punch-cli-design.md
│   ├── 2026-01-18-next-features.md
│   └── 2026-01-19-edit-command-implementation.md
└── sessions/              # Development session notes
    └── 2026-01-19-edit-command-implementation.md
```

## Test-Driven Development

**IMPORTANT:** All new features MUST use TDD. See `CLAUDE.md` in project root.

### TDD Workflow

1. **RED:** Write failing test first
   ```bash
   bun test src/commands/feature.test.ts
   # Verify it fails for the right reason
   ```

2. **GREEN:** Write minimal code to pass
   ```bash
   bun test src/commands/feature.test.ts
   # Verify it passes
   ```

3. **REFACTOR:** Clean up while keeping tests green
   ```bash
   bun test  # All tests pass
   ```

### Test Strategy

**In-memory SQLite:** Fast tests using `test-db.ts` helper

```typescript
import { test, expect, beforeEach } from "bun:test";
import { createTestDb } from "../db/test-db";

let db: ReturnType<typeof createTestDb>;

beforeEach(() => {
  db = createTestDb();  // Fresh DB for each test
});

test("feature works", () => {
  // Test implementation
});
```

**Coverage Goals:**
- Happy path (core functionality)
- Edge cases (boundary conditions)
- Error cases (validation, missing data)
- TypeScript strict mode compliance

### Running Tests

```bash
# All tests
bun test

# Specific file
bun test src/commands/edit.test.ts

# Watch mode
bun test --watch

# Type checking
bun run typecheck
```

## Adding a New Command

### Step-by-Step Guide

**1. Create test file first (TDD!)**

```typescript
// src/commands/yourcommand.test.ts
import { test, expect, beforeEach, describe } from "bun:test";
import { createTestDb } from "../db/test-db";
import { yourCommand } from "./yourcommand";

describe("punch yourcommand", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  test("does what it should", () => {
    // Write failing test
    expect(true).toBe(false);
  });
});
```

**2. Run test (should fail - RED)**

```bash
bun test src/commands/yourcommand.test.ts
```

**3. Create implementation file**

```typescript
// src/commands/yourcommand.ts
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { entries } from "../db/schema";

export async function yourCommand(
  db: BunSQLiteDatabase,
  options: YourOptionsType
) {
  // Minimal implementation to pass test
}
```

**4. Run test (should pass - GREEN)**

```bash
bun test src/commands/yourcommand.test.ts
```

**5. Add to router**

```typescript
// src/index.ts
case "yourcommand": {
  const result = await yourCommand(db, options);
  console.log(result);
  break;
}
```

**6. Update help text**

```typescript
// src/index.ts - printHelp() function
console.log(`
  yourcommand [args]       Description of command
    --flag <value>         Flag description
`);
```

**7. Update documentation**

Add command details to `docs/COMMANDS.md`

**8. Run all tests**

```bash
bun test
bun run typecheck
```

**9. Manual testing**

```bash
bun run index.ts yourcommand --help
bun run index.ts yourcommand <test-args>
```

## Code Style Guide

### TypeScript

- **Strict mode:** Always enabled, no `any` types
- **Explicit types:** Use type annotations for function parameters
- **Async/await:** Prefer over promises
- **Const over let:** Use `const` unless reassignment needed

### Naming Conventions

- **Files:** lowercase-kebab.ts (e.g., `punch-edit.ts`)
- **Functions:** camelCase (e.g., `punchEdit`, `findTargetEntry`)
- **Types:** PascalCase (e.g., `EntryType`, `CommandOptions`)
- **Constants:** UPPER_SNAKE_CASE for true constants

### Function Size

- Keep functions small (< 30 lines ideally)
- Extract helpers for complex logic
- Single responsibility principle

### Comments

- Use JSDoc for public APIs
- Explain "why" not "what"
- Avoid obvious comments

```typescript
// Bad
// Set the end time to now
entry.endTime = new Date();

// Good
// Parse time relative to entry's date to prevent moving historical entries to today
const endTime = parseTime(timeStr, entry.startTime);
```

### Error Handling

- Clear, actionable error messages
- Include context (what failed, why, how to fix)
- Use Error objects, not strings

```typescript
// Good
throw new Error(
  `End time must be after start time (start: ${formatTime(startTime)}, end: ${formatTime(endTime)})`
);

// Bad
throw new Error("Invalid time");
```

## Database Management

### Schema Changes

```bash
# 1. Modify src/db/schema.ts

# 2. Generate migration
bunx drizzle-kit generate --dialect sqlite --schema ./src/db/schema.ts

# 3. Run migration
bun run migrate

# 4. Update test-db.ts if needed
```

### Viewing Database

```bash
# Open Drizzle Studio
bun run db:studio

# Or use sqlite3 CLI
sqlite3 ~/.local/share/punch/punch.db
```

### Database Location

Development: `~/.local/share/punch/punch.db`
Tests: In-memory (`:memory:`)

## Linting & Formatting

```bash
# Run linter
bun run lint

# Run formatter
bun run format

# Type checking
bun run typecheck
```

## Building

```bash
# Build standalone binary
bun build src/index.ts --compile --outfile punch

# Test binary
./punch in "Test task"
./punch log
./punch out
```

## Known Issues & TODOs

### Immediate (v0.1 completion)

- [ ] Fix `out.test.ts:36` async test syntax
- [ ] Add hex validation for ID prefixes in `edit.ts`
- [ ] Add test for invalid hex characters in ID prefix

### Short-term (v0.2)

- [ ] Implement `punch status` command
- [ ] Implement `punch summary` command
- [ ] Implement `punch cancel` command
- [ ] Implement `punch delete` command
- [ ] Add colors to output (green success, red errors)

### Medium-term (v0.3)

- [ ] Natural language time parsing ("yesterday at 2pm")
- [ ] Tags support (`--tags work,urgent`)
- [ ] JSON export functionality
- [ ] Edit history/audit trail
- [ ] Better error messages with suggestions

### Long-term (v0.4+)

- [ ] Inactivity detection
- [ ] Interactive prompts for edits
- [ ] Task-level breakdown in summary
- [ ] Sync backend preparation
- [ ] Multi-device support

## Contributing

This is a personal learning project, but suggestions welcome!

### Workflow

1. Read design docs in `docs/plans/`
2. Follow TDD approach (required)
3. Match existing code patterns
4. Run tests before committing
5. Update docs when adding features

### Questions?

Check documentation:
- `docs/OVERVIEW.md` - Architecture & design decisions
- `docs/COMMANDS.md` - Command reference
- `docs/plans/` - Feature planning docs
- `docs/sessions/` - Development notes

## Resources

- [Bun Documentation](https://bun.sh/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [SQLite](https://www.sqlite.org/docs.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## License

Private project (not yet open source)
