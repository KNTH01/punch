# Agents Guide - Punch CLI

Quick reference for AI coding agents working in this repository.

## Project Context

CLI time tracker built with Bun. Focus: learning Bun's native APIs (avoid npm deps when Bun has built-ins).

## Build/Test Commands

```bash
# Development
bun install                           # Install dependencies
bun run src/index.ts <command>            # Run CLI

# Testing
bun test                              # Run all tests
bun test src/commands/edit.test.ts    # Run single test file
bun test --watch                      # Watch mode
bun run typecheck                     # TypeScript type checking

# Database
bun run migrate                       # Run migrations
bun run db:studio                     # Open Drizzle Studio

# Quality
bun run lint                          # Run oxlint
bun run format                        # Run oxfmt

# Build
bun build src/index.ts --compile --outfile punch
```

## Test-Driven Development (MANDATORY)

**CRITICAL:** All features and fixes MUST use TDD. Red-Green-Refactor cycle:
1. RED: Write failing test first, verify it fails for right reason
2. GREEN: Write minimal code to pass
3. REFACTOR: Clean up while keeping tests green

If you write implementation before tests, DELETE it and start over with TDD.

### Test Structure

```typescript
import { test, expect, beforeEach, describe } from "bun:test";
import { createTestDb } from "../db/test-db";

describe("feature name", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();  // Fresh in-memory DB each test
  });

  test("does what it should", () => {
    // Arrange, Act, Assert
  });
});
```

## TypeScript Configuration

- **Strict mode:** Always enabled, NEVER use `any`
- **Target:** ESNext with bundler module resolution
- **noUncheckedIndexedAccess:** true - check array access
- **Import TS extensions:** Allowed (`.ts` in imports is fine)

## Code Style

### Imports

Order: external → internal (db, lib, types)
```typescript
import { eq, isNull } from "drizzle-orm";                    // External
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { entries } from "../db/schema";                      // Internal
import { parseTime } from "../lib/time";
```

### Types

- Use `type` for type aliases, `interface` for object shapes
- Explicit parameter types, inferred return types OK if simple
- Destructure with inline types when clear

```typescript
// Good
export async function punchEdit(
  db: BunSQLiteDatabase,
  options: {
    idOrPosition?: string;
    taskName?: string;
    project?: string;
  }
) {
  // Return type inferred
}

// Type aliases
type CommandOptions = { project?: string };
```

### Naming Conventions

- **Files:** `kebab-case.ts` (e.g., `punch-edit.ts`)
- **Functions:** `camelCase` (e.g., `punchEdit`, `findTargetEntry`)
- **Types:** `PascalCase` (e.g., `EntryType`, `CommandOptions`)
- **Constants:** `UPPER_SNAKE_CASE` for true constants
- **Prefix:** Command functions use `punch*` prefix (e.g., `punchIn`, `punchOut`)

### Function Style

- Keep functions < 30 lines when possible
- Single responsibility principle
- Extract helpers for complex logic
- Async/await preferred over raw promises
- Use `const` unless reassignment needed

```typescript
// Good: Small, focused function
export async function punchIn(
  db: BunSQLiteDatabase,
  taskName: string,
  options: { project?: string } = {},
) {
  const activeTask = db.select().from(entries).where(isNull(entries.endTime)).limit(1).get();
  
  if (activeTask) {
    const timeStr = formatTime(activeTask.startTime);
    throw new Error(`Task already running: "${activeTask.taskName}" started at ${timeStr}`);
  }

  const [entry] = await db.insert(entries).values({
    taskName,
    project: options.project || null,
    startTime: new Date(),
    endTime: null,
  }).returning();

  return entry;
}
```

### Error Handling

- Throw `Error` objects, not strings
- Clear, actionable messages with context
- Include what failed, why, and how to fix

```typescript
// Good
throw new Error(
  `End time must be after start time (start: ${startStr}, end: ${endStr})`
);

// Bad
throw new Error("Invalid time");
throw "Invalid time";  // Never throw strings
```

### Comments

- Explain "why" not "what"
- Avoid obvious comments
- Use JSDoc for public APIs

```typescript
// Good: Explains non-obvious decision
// Parse time relative to entry's date to prevent moving historical entries to today
const endTime = parseTime(timeStr, entry.startTime);

// Bad: States the obvious
// Set the end time to now
entry.endTime = new Date();
```

### Null/Undefined Handling

- Use `undefined` for optional parameters
- Use `null` for database NULL values (Drizzle convention)
- Check with `!== undefined` when `undefined` specifically, `!value` for falsy

```typescript
// Database nulls
project: options.project || null,  // null for DB

// Optional params check
if (options.taskName !== undefined) {
  updates.taskName = options.taskName;
}
```

## Database Patterns

### Queries

```typescript
// Select with conditions
const entry = db.select()
  .from(entries)
  .where(isNull(entries.endTime))
  .limit(1)
  .get();  // Single result

// Multiple results
const matches = db.select()
  .from(entries)
  .where(like(entries.id, `${prefix}%`))
  .all();  // Array of results

// Insert with returning
const [created] = await db.insert(entries)
  .values({ taskName, startTime: new Date() })
  .returning();

// Update with returning
const [updated] = await db.update(entries)
  .set({ endTime: new Date(), updatedAt: new Date() })
  .where(eq(entries.id, id))
  .returning();
```

### Schema Conventions

- Use `timestamp_ms` mode for dates (matches JS Date precision)
- UUID primary keys via `crypto.randomUUID()`
- `endTime = null` means active task
- Always update `updatedAt` on modifications

## File Structure

```
src/
├── db/
│   ├── schema.ts          # Drizzle schema
│   ├── index.ts           # DB connection
│   └── test-db.ts         # In-memory test DB
├── commands/
│   ├── name.ts            # Command implementation
│   └── name.test.ts       # Tests (TDD!)
├── lib/
│   ├── time.ts            # Shared utilities
│   └── format.ts          # Output formatting
└── index.ts               # CLI router
```

## Adding a New Command

1. Create `src/commands/name.test.ts` with failing tests (TDD!)
2. Create `src/commands/name.ts` with minimal implementation
3. Add route case in `src/index.ts`
4. Update `HELP_TEXT` in `src/index.ts`
5. Run `bun test` - all pass
6. Update `docs/COMMANDS.md`

## Common Patterns

### Time Parsing

Use `parseTime()` from `lib/time.ts`:
```typescript
import { parseTime } from "../lib/time";

// Parse relative to date (for edits)
const time = parseTime("14:30", entry.startTime);

// Parse absolute
const time = parseTime("2pm");
```

### Argument Parsing

Use `parseArgs()` from `index.ts`:
```typescript
const { flags, positional } = parseArgs(process.argv.slice(3));
const project = (flags.p || flags.project) as string | undefined;
```

### Output Formatting

Use consistent success/error format:
```typescript
// Success
console.log(`✓ Started '${taskName}'${projectPart} at ${time}`);

// Error
console.error(`Error: ${error.message}`);
```

## Avoid

- ❌ npm packages when Bun has built-in equivalent
- ❌ `any` type (strict mode enforced)
- ❌ Throwing strings (use `Error` objects)
- ❌ Implementation before tests (TDD required)
- ❌ Large functions (> 30 lines)
- ❌ Obvious comments
- ❌ Magic numbers (use named constants)

## Resources

- Docs: `docs/OVERVIEW.md`, `docs/COMMANDS.md`, `docs/DEVELOPMENT.md`
- Design: `docs/plans/*.md`
- Sessions: `docs/sessions/*.md`
