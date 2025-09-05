# @hugsylabs/hugsy-types

## 0.0.7

### Patch Changes

- 57f25ac: Fix Claude Code settings.json generation and validation

  Compiler & Types:
  - Add required $schema field to generated settings.json
  - Fix hooks format: convert simple format to nested format with proper type literals
  - Fix matcher format: convert "Tool(args)" to "Tool" (Claude Code only supports tool-level matching)
  - Add comprehensive validateSettings method for format validation
  - Update StatusLineConfig to support both 'value' and 'text' fields
  - Remove problematic external plugins with incorrect matcher formats from .hugsyrc.json
  - Add extensive unit tests for compiler validation (141 tests)
  - Update integration test snapshots for new $schema field

  UI Package:
  - Add path security validation to server.js to prevent directory traversal attacks
  - Implement lazy loading for Monaco Editor to improve initial load performance
  - Add React.memo and useMemo optimizations to reduce unnecessary re-renders
  - Create new smaller components: LazyEditor, ConfigToolbar, CommandExplorer, JsonPreview
  - Fix TypeScript types and improve type safety across components
  - Fix floating promises and async handling in components

## 0.0.6

### Patch Changes

- 2ab2107: fix: Fix multiple compiler bugs
  - Fix inherited values (includeCoAuthoredBy, cleanupPeriodDays) becoming null
  - Implement plugin validate function calls with error handling
  - Add env value type validation to reject non-string values
  - Normalize uppercase field names (ENV→env, Permissions→permissions, etc)
  - Add comprehensive tests for all bug fixes

## 0.0.5

### Patch Changes

- ea3292e: fix: Fix changeset release workflow to automatically update pnpm-lock.yaml
  - Add version:packages script that updates lockfile after version bumps
  - Ensure Version Packages PR includes updated lockfile
  - This fixes CI failures on changeset-created PRs

## 0.0.4

### Patch Changes

- 26cad30: feat: Improve error and log message formatting
  - Add emoji prefixes for clearer error (⚠️) and info (ℹ️) messages
  - Make console output more user-friendly and scannable

## 0.0.3

### Patch Changes

- 6c01877: feat: Add TypeScript type exports and async plugin support
  - Export Plugin and HugsyPlugin types from compiler
  - Support async transform functions in plugins
  - Remove statusLine config and backup file generation

- 00ba9d5: docs: Update README comparison table
  - Update config size comparison from "200+ lines" to "10 lines" for better clarity
  - Improve documentation accuracy

- e96a2f8: fix: update version script to include lockfile-only install
  - Fix changeset workflow by updating package.json version script
  - Ensures pnpm install --lockfile-only runs after version bumping

- dad9ae2: readme update

## 0.0.2

### Patch Changes

- 5a4d1be: Initial setup for automated release workflow with changesets
  - Configure changesets for npm publishing
  - Add publish:ci script for GitHub Actions
  - Set packages to public access
