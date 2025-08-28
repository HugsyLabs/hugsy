---
description: Fix common issues
argument-hint: [lint|types|format]
---

Fix common development issues based on: $ARGUMENTS

## Available Fixes:

### lint
- Run ESLint with auto-fix: `pnpm lint --fix`
- Fix any remaining manual issues

### types
- Check TypeScript errors: `pnpm type-check`
- Fix type issues in the codebase

### format
- Run Prettier: `pnpm format`
- Ensure consistent code formatting

If no argument provided, run all fixes in sequence.