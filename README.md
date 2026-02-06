# Punch

A fast, simple CLI time tracker built with Bun.

## Installation

### With mise (recommended)

```bash
git clone https://github.com/knth/punch.git
cd punch
mise install        # installs correct Bun version
bun install         # install dependencies
mise run build      # compile binary
mise run install    # copy to ~/.local/bin
```

### Manual

```bash
git clone https://github.com/knth/punch.git
cd punch
bun install
bun run build
cp punch ~/.local/bin/
```

### Cross-platform binaries

```bash
mise run build-all
ls dist/            # punch-linux-x64, punch-darwin-arm64, etc.
```

## Commands

- `punch in "task" [-p project]` - Start tracking time
- `punch out [-a HH:MM]` - Stop tracking (optional custom time)
- `punch log [--today|--week|--month] [--project name]` - List entries
- `punch edit [<id>] [task] [--flags]` - Modify entries

## Development

```bash
mise run test          # Run tests
mise run typecheck     # TypeScript checks
mise run lint          # Run oxlint
mise run format        # Run oxfmt
mise run db:migrate    # Run database migrations
mise run db:studio     # Open Drizzle Studio
```

All tasks also work via `bun run <script>` directly.

See [docs/](docs/) for detailed documentation, architecture, and current development status.

## Tech Stack

- **Runtime:** Bun
- **Database:** SQLite via `bun:sqlite` + Drizzle ORM
- **Testing:** `bun:test`
- **Task runner:** mise

---

Built with [Bun](https://bun.sh) - a fast all-in-one JavaScript runtime.
