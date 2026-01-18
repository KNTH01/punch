# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Project

```bash
bun install           # Install dependencies
bun run index.ts      # Run the main entry point
```

## TypeScript Configuration

- Target: ESNext with bundler module resolution
- Strict mode enabled
- JSX: react-jsx (React support configured)
- Import TS extensions allowed (no emit/bundler mode)
