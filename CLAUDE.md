# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goals

- Learning Bun runtime and native APIs (avoid npm dependencies when Bun has built-in equivalents)
- Building foundation for future sync backend/cloud hosting

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
