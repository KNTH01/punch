# Punch

A fast, simple CLI time tracker built with Bun.

## Quick Start

```bash
# Install dependencies
bun install

# Start tracking time
bun run index.ts in "Fix bug" -p project-name

# Stop tracking
bun run index.ts out

# View entries
bun run index.ts log
```

## Commands

- `punch in "task" [-p project]` - Start tracking time
- `punch out [-a HH:MM]` - Stop tracking (optional custom time)
- `punch log [--today|--week|--month] [--project name]` - List entries
- `punch edit [<id>] [task] [--flags]` - Modify entries

## Development

```bash
bun test              # Run tests
bun run typecheck     # TypeScript checks
bun run migrate       # Run database migrations
```

See [docs/](docs/) for detailed documentation, architecture, and current development status.

## Tech Stack

- **Runtime:** Bun
- **Database:** SQLite via `bun:sqlite` + Drizzle ORM
- **Testing:** `bun:test`

---

Built with [Bun](https://bun.sh) - a fast all-in-one JavaScript runtime.
