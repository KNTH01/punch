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

## Development Workflow

### Test-Driven Development (Required)

**IMPORTANT:** All new features and bug fixes MUST use Test-Driven Development.

When implementing any feature:
1. Use the `superpowers:test-driven-development` skill BEFORE writing implementation code
2. Follow the Red-Green-Refactor cycle:
   - RED: Write failing test first
   - Verify it fails for the right reason
   - GREEN: Write minimal code to pass
   - Verify all tests pass
   - REFACTOR: Clean up while keeping tests green
3. If you write implementation code before tests, DELETE it and start over with TDD

### Running Tests

```bash
bun test                    # Run all tests
bun test src/path/file.test.ts  # Run specific test file
bun run typecheck           # TypeScript type checking
```

## TypeScript Configuration

- Target: ESNext with bundler module resolution
- Strict mode enabled
- JSX: react-jsx (React support configured)
- Import TS extensions allowed (no emit/bundler mode)

## Code Style

- Follow existing patterns in the codebase
- Maintain TypeScript strict mode compliance
- Keep functions small and focused
- Write clear, descriptive test names
