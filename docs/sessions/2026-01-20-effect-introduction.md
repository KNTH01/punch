# Session: Introducing Effect-TS to Punch

**Date**: 2026-01-20  
**Goal**: Add Effect-TS for typed, composable core logic that can be shared between CLI and future Hono backend.

## Why Effect?

### Problem with current approach

```typescript
// src/commands/in.ts - throws generic Error
async function punchIn(db, taskName, options): Promise<Entry> {
  if (activeTask) {
    throw new Error(`Task already running: "${activeTask.taskName}"...`);
  }
  // ...
}
```

- Caller doesn't know what errors can occur (not in type signature)
- Error handling is stringly-typed (`error.message.includes("already running")`)
- Hard to share between CLI and HTTP backend (different error presentation)

### Solution with Effect

```typescript
// src/core/punch-in.ts - typed errors in signature
function punchIn(db, taskName, options): Effect.Effect<Entry, TaskAlreadyRunningError> {
  if (activeTask) {
    return Effect.fail(new TaskAlreadyRunningError(activeTask.taskName, activeTask.startTime));
  }
  // ...
}
```

- Error type is in the signature - caller knows exactly what can fail
- Typed error objects carry structured data (taskName, startTime)
- CLI and backend interpret the same Effect differently

## Architecture

```
src/
├── core/                    # Effect-based business logic (NEW)
│   ├── errors.ts            # Typed domain errors
│   ├── punch-in.ts          # Effect: Entry | TaskAlreadyRunningError
│   └── punch-in.test.ts     # Tests for Effect version
├── commands/                # Original implementations (keep for reference)
│   └── in.ts                # Old Promise-based version
└── index.ts                 # CLI - interprets Effects → console output
```

**Future**: Same `src/core/` used by Hono backend, interpreting Effects → HTTP responses.

## Key Effect Concepts

### 1. Effect.gen - Generator syntax

Like `async/await` but returns an Effect description:

```typescript
function punchIn(db, taskName, options) {
  return Effect.gen(function* () {
    // This function describes what to do
    // Nothing executes until you "run" the Effect
    
    const result = yield* someEffect;  // Like await
    return result;
  });
}
```

### 2. yield* - Unwrap an Effect

```typescript
// Unwrap success value
const entry = yield* Effect.succeed({ id: "123" });

// Unwrap a Promise wrapped in Effect
const [entry] = yield* Effect.promise(() => db.insert(...).returning());

// Short-circuit on failure
yield* Effect.fail(new TaskAlreadyRunningError(...));
// Code below this line doesn't run if we fail
```

### 3. Effect.fail - Typed failures

```typescript
// Create a failure Effect with typed error
yield* Effect.fail(new TaskAlreadyRunningError(taskName, startTime));
```

The error type becomes part of the function's return type signature.

### 4. Effect.runPromiseExit - Execute and get result

```typescript
const exit = await Effect.runPromiseExit(program);

if (exit._tag === "Success") {
  const entry = exit.value;  // Typed as Entry
}

if (exit._tag === "Failure") {
  const cause = exit.cause;
  if (cause._tag === "Fail") {
    const error = cause.error;  // Typed as TaskAlreadyRunningError
  }
}
```

## Files Created

### src/core/errors.ts

```typescript
export class TaskAlreadyRunningError {
  readonly _tag = "TaskAlreadyRunningError";  // For type discrimination
  constructor(
    readonly taskName: string,
    readonly startTime: Date,
  ) {}
}
```

The `_tag` pattern is Effect convention for discriminated unions.

### src/core/punch-in.ts

```typescript
export function punchIn(
  db: BunSQLiteDatabase,
  taskName: string,
  options: { project?: string } = {},
): Effect.Effect<Entry, TaskAlreadyRunningError> {
  return Effect.gen(function* () {
    // Check for active task
    const activeTask = db.select().from(entries).where(isNull(entries.endTime)).get();

    if (activeTask) {
      return yield* Effect.fail(
        new TaskAlreadyRunningError(activeTask.taskName, activeTask.startTime),
      );
    }

    // Create new entry
    const [entry] = yield* Effect.promise(() =>
      db.insert(entries).values({...}).returning(),
    );

    return entry!;
  });
}
```

### src/core/punch-in.test.ts

```typescript
test("creates entry when no active task", async () => {
  const exit = await Effect.runPromiseExit(punchIn(db, "coding"));

  expect(exit._tag).toBe("Success");
  if (exit._tag === "Success") {
    expect(exit.value.taskName).toBe("coding");
  }
});

test("fails with TaskAlreadyRunningError when task is active", async () => {
  await Effect.runPromise(punchIn(db, "existing"));
  
  const exit = await Effect.runPromiseExit(punchIn(db, "new"));

  expect(exit._tag).toBe("Failure");
  // Assert on typed error...
});
```

### Updated src/index.ts (CLI)

```typescript
case "in":
case "start": {
  const program = punchIn(db, taskName, { project });
  const exit = await Effect.runPromiseExit(program);

  if (exit._tag === "Failure") {
    const cause = exit.cause;
    if (cause._tag === "Fail" && cause.error instanceof TaskAlreadyRunningError) {
      // Handle typed error with full data access
      console.error(`Error: Task already running: "${cause.error.taskName}"`);
    }
    process.exit(1);
  }

  const result = exit.value;
  console.log(`Started '${result.taskName}'...`);
}
```

## Pattern for New Modules

When implementing `punchOut`, `punchEdit`, `punchLog`:

### 1. Define errors in src/core/errors.ts

```typescript
export class NoActiveTaskError {
  readonly _tag = "NoActiveTaskError";
}

export class EntryNotFoundError {
  readonly _tag = "EntryNotFoundError";
  constructor(readonly id: string) {}
}
```

### 2. Create Effect function (TDD!)

```typescript
// src/core/punch-out.ts
export function punchOut(
  db: BunSQLiteDatabase,
  options: { at?: string } = {},
): Effect.Effect<Entry, NoActiveTaskError | InvalidTimeError> {
  return Effect.gen(function* () {
    const activeTask = db.select()...;
    
    if (!activeTask) {
      return yield* Effect.fail(new NoActiveTaskError());
    }
    
    // ... validation, update, return
  });
}
```

### 3. Update CLI to handle new errors

```typescript
case "out": {
  const exit = await Effect.runPromiseExit(punchOut(db, { at }));
  
  if (exit._tag === "Failure") {
    if (cause.error instanceof NoActiveTaskError) {
      console.error("Error: No active task to stop");
    }
    // ... handle other errors
  }
}
```

## TDD Cycle Reminder

1. **RED**: Write failing test first
2. **Verify RED**: Run test, confirm it fails for right reason
3. **GREEN**: Write minimal code to pass
4. **Verify GREEN**: Run test, confirm pass
5. **REFACTOR**: Clean up while keeping tests green
6. **Repeat** for next behavior

## What We Learned

1. **Effect.gen** is like async functions but returns descriptions, not executions
2. **yield*** unwraps Effects (like await for Promises)
3. **Effect.fail** creates typed failures that appear in the function signature
4. **Effect.runPromiseExit** executes and returns typed Success/Failure
5. **_tag pattern** enables TypeScript to discriminate between error types
6. **CLI as interpreter**: Same Effect, different presentation (console vs HTTP)

## Next Steps

- [ ] Implement `punchOut` with `NoActiveTaskError`, `InvalidTimeError`
- [ ] Implement `punchEdit` with `EntryNotFoundError`, validation errors
- [ ] Implement `punchLog` (likely no errors, just returns `Effect<Entry[]>`)
- [ ] Explore Effect Services for database dependency injection (advanced)
