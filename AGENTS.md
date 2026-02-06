# Agents Guide - Punch CLI

Quick reference for AI coding agents working in this repository.

## Project Context

CLI time tracker built with Bun.

Focus: learning Bun's native APIs (avoid npm deps when Bun has built-ins).
Focus: learning effect-ts -- when asking for review about Effect, give hints, but not the whole solution right away, so I can try to implement myself.

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
bun run db:migrate                    # Run migrations
bun run db:studio                     # Open Drizzle Studio

# Quality
bun run lint                          # Run oxlint
bun run format                        # Run oxfmt

# Build
bun run build                         # Compile standalone binary
```

## Test-Driven Development (MANDATORY)

**CRITICAL:** All features and fixes MUST use TDD. Red-Green-Refactor cycle:

1. RED: Write failing test first, verify it fails for right reason
2. GREEN: Write minimal code to pass
3. REFACTOR: Clean up while keeping tests green

If you write implementation before tests, DELETE it and start over with TDD.

## TypeScript Configuration

- **Strict mode:** Always enabled, NEVER use `any`
- **Target:** ESNext with bundler module resolution
- **noUncheckedIndexedAccess:** true - check array access
- **Import TS extensions:** Allowed (`.ts` in imports is fine)

## Code Style

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
- Use `const` unless reassignment needed

### Comments

- Explain "why" not "what"
- Avoid obvious comments

### Schema Conventions

- Use `timestamp_ms` mode for dates (matches JS Date precision)
- UUID primary keys via `crypto.randomUUID()`
- `endTime = null` means active task
- Always update `updatedAt` on modifications

## btca

When you need up-to-date information about technologies used in this project, ask the user if they'd like you to use btca to research.

**Available resources**: bun, drizzleOrm, typescript, effect

### Usage

```bash
btca ask -r <resource> -q "<question>"
```

Use multiple `-r` flags to query multiple resources at once:

```bash
btca ask -r bun -r effect -q "How do I integrate Effect with Bun?"
```
