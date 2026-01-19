# Punch - Project Overview

**A feature-rich, fast CLI time tracker built with Bun**

## What is Punch?

Punch is a command-line time tracking tool that helps you track work time on tasks and projects. Built with Bun to learn its native APIs, Punch uses SQLite for local data storage with plans to evolve into a self-hosted sync backend.

## Why Punch?

### Learning Goals
1. **Learn Bun's ecosystem:** Native APIs, built-in SQLite, fast runtime
2. **Build useful tool:** Real-world time tracking application
3. **Practice TDD:** Strict test-driven development approach
4. **Foundation for sync:** UUID-based design enables future offline-first sync

### Design Philosophy
- **Simple & Fast:** CLI-first, minimal dependencies
- **Local-first:** SQLite database, works offline
- **User-friendly:** Clear error messages, intuitive commands
- **Future-proof:** Designed for eventual multi-device sync

## Core Concepts

### Punch Clock Metaphor
Commands use "punch in/out" language inspired by physical punch clocks:
- `punch in` - Start tracking (clock in)
- `punch out` - Stop tracking (clock out)

### Project Organization
Tasks belong to projects for better organization:
```bash
punch in "Fix authentication bug" -p acme-app
punch in "Learning Bun" -p personal
```

### Active Task Model
- Only one task can be active at a time
- Active task = entry with `end_time = NULL`
- Query-based detection (no separate state table)

### No Pause/Resume
Simple mental model: each entry = one continuous work period
- Interrupted? Just stop and start again
- Reports aggregate multiple sessions automatically

## Data Model

### Database Schema

```typescript
entries {
  id: text (UUID primary key)
  taskName: text (required)
  project: text (optional)
  startTime: timestamp_ms (required)
  endTime: timestamp_ms (null = active)
  lastActivity: timestamp_ms (future: inactivity detection)
  createdAt: timestamp_ms (audit trail)
  updatedAt: timestamp_ms (audit trail)
}
```

### Key Design Decisions

**UUID Primary Keys**
- Uses `crypto.randomUUID()` (Bun native API)
- Enables offline-first sync when backend is added
- Prevents ID collisions across devices
- Minimal performance cost at time tracking scale

**Millisecond Timestamps**
- Using `mode: "timestamp_ms"` matches JavaScript Date precision
- Prevents precision loss when storing/retrieving times
- Same storage cost as seconds (both are integers)
- Future-proof for precise duration calculations

**Active Task Detection**
- Query-based: `WHERE end_time IS NULL`
- Simpler - single source of truth
- Can't get out of sync
- Fast enough with SQLite indexing

### File Locations

Following XDG Base Directory Specification:
- **Database:** `~/.local/share/punch/punch.db`
  - Or `$XDG_DATA_HOME/punch/punch.db` if set
- **Config (future):** `~/.config/punch/config.json`

## Tech Stack

### Runtime & Dependencies
- **Runtime:** Bun 1.3.6+
- **Database:** SQLite via `bun:sqlite` driver
- **ORM:** Drizzle ORM with drizzle-kit
- **Testing:** `bun:test` with in-memory SQLite
- **Type Safety:** TypeScript strict mode
- **Linting:** oxlint with TypeScript-aware checks
- **Formatting:** oxfmt

### Why These Choices?

**Bun**
- Primary learning goal
- Fast runtime with modern APIs
- Built-in SQLite support
- Native test runner

**Drizzle ORM**
- Type-safe schema definitions
- Shares schema across future monorepo (cli, backend, frontend)
- Clean migration management
- Still uses `bun:sqlite` as driver

**No CLI Framework**
- Learning Bun's native argument parsing
- Avoid npm dependencies when Bun has equivalents
- Direct control over CLI behavior

**SQLite**
- Simple, local-first, fast
- Perfect for CLI tool
- Will sync to backend eventually
- No server setup required

## Project Structure

```
src/
├── db/
│   ├── schema.ts          # Drizzle schema definitions
│   ├── index.ts           # DB connection & initialization
│   └── test-db.ts         # In-memory DB for tests
├── commands/
│   ├── in.ts              # Start tracking
│   ├── out.ts             # Stop tracking
│   ├── log.ts             # List entries
│   └── edit.ts            # Modify entries
├── lib/
│   ├── time.ts            # Time parsing utilities
│   └── format.ts          # Output formatting
└── index.ts               # CLI entry point & routing

docs/
├── OVERVIEW.md            # This file
├── COMMANDS.md            # Detailed command reference
├── DEVELOPMENT.md         # Development guide
├── plans/                 # Design documents
└── sessions/              # Development session notes
```

## Development Workflow

### Test-Driven Development (Required)

All new features MUST use TDD:
1. Write failing test first (RED)
2. Verify it fails for the right reason
3. Write minimal code to pass (GREEN)
4. Verify all tests pass
5. Refactor while keeping tests green (REFACTOR)

See `CLAUDE.md` in project root for full TDD guidelines.

### Adding a New Command

1. Create `src/commands/your-command.test.ts` with tests (TDD!)
2. Create `src/commands/your-command.ts` with implementation
3. Add route case in `src/index.ts`
4. Update help text in `src/index.ts`
5. Run tests: `bun test`
6. Update documentation in `docs/COMMANDS.md`

### Code Style
- Follow existing patterns in codebase
- Maintain TypeScript strict mode compliance
- Keep functions small and focused
- Write clear, descriptive test names
- Use native Bun APIs when available

## Future Roadmap

### Phase 1: Complete MVP Commands (v0.2)
- `punch status` - Show current active task
- `punch summary` - Aggregate reports by project/task
- `punch cancel` - Delete active task
- `punch delete` - Remove completed entries

### Phase 2: Enhanced Features (v0.3)
- Tags support (`--tags work,urgent`)
- Natural language time parsing ("yesterday at 2pm")
- JSON export for backup/analysis
- Edit history/audit trail
- Better error messages and colors

### Phase 3: System Integration (v0.4)
- Inactivity detection using system idle time
- Prompt to adjust end time when idle detected
- Prevent forgotten time entries

### Phase 4: Monorepo Evolution (v1.0)
```
packages/
├── cli/          # Current project
├── backend/      # API server (shared schema)
├── frontend/     # Web UI (shared types)
└── shared/       # Drizzle schema & types
```

### Phase 5: Cloud Sync (v2.0)
- Self-hosted sync backend
- Multi-device support
- Web UI for reports and analytics
- Optional paid cloud hosting

## Success Criteria

**MVP is successful when:**
- Can track time on tasks with projects
- Can view current status and history
- Can generate basic reports
- Database persists correctly
- Error handling is clear and helpful
- Built using Bun's native APIs (learning goal achieved)

## Documentation

- **OVERVIEW.md** (this file) - Project vision and architecture
- **COMMANDS.md** - Detailed command reference with examples
- **DEVELOPMENT.md** - Current development status and testing
- **plans/** - Design documents and feature planning
- **sessions/** - Development session notes and decisions

## License

Private project (not yet open source)
