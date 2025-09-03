# @hugsylabs/hugsy-compiler

## 0.1.8

### Patch Changes

- 9dfedbc: Fix test failures in CI environment
  - Convert all relative plugin and preset paths to absolute paths in compiler tests
  - This resolves file resolution issues that occur in CI environments
  - Ensures consistent test behavior across local and CI environments
  - Update CLI to use the fixed compiler version

## 0.1.7

### Patch Changes

- Update dependencies and fix deprecation warnings
  - Update @hugsylabs/hugsy-compiler from ^0.1.3 to ^0.1.6 in CLI package
  - Remove deprecated @types/glob dependency from compiler package (glob now includes its own types)
  - Update @vitest/coverage-v8 to 1.6.1 to fix peer dependency warnings
  - This includes all recent fixes for plugin loading in ESM environments
  - Fixes issue where plugins couldn't be loaded by global hugsy installation

## 0.1.6

### Patch Changes

- 395180f: Fix plugin loading in ESM environment
  - Replace `require.resolve` with filesystem-based module resolution (ESM compatible)
  - Support loading plugins from project's local node_modules
  - Add createRequire as fallback for complex resolution scenarios
  - Properly handle both ESM and CommonJS plugin entry points
  - Enable global hugsy to load locally installed plugins

  This fixes the issue where plugins installed with `hugsy install <plugin>` were not being loaded correctly.

## 0.1.5

### Patch Changes

- 64dcb18: Fix plugin loading errors and improve module resolution
  - Fixed plugin loading to return null on failure instead of empty object
  - Improved npm package resolution using require.resolve
  - Added better error logging for debugging plugin loading issues
  - Plugins that fail to load are now correctly excluded from the count

## 0.1.4

### Patch Changes

- 782618a: Fix slash commands and ESM import issues
  - Fixed destructive build command that was removing all dist directories
  - Fixed recursive dev command issue
  - Fixed release command syntax (pnpm build → pnpm run build)
  - Fixed ESM imports for glob and yaml packages to use named exports
  - Ensured proper TypeScript declaration files generation

## 0.1.3

### Patch Changes

- 2ab2107: fix: Fix multiple compiler bugs
  - Fix inherited values (includeCoAuthoredBy, cleanupPeriodDays) becoming null
  - Implement plugin validate function calls with error handling
  - Add env value type validation to reject non-string values
  - Normalize uppercase field names (ENV→env, Permissions→permissions, etc)
  - Add comprehensive tests for all bug fixes

- Updated dependencies [2ab2107]
  - @hugsylabs/hugsy-types@0.0.6

## 0.1.2

### Patch Changes

- ea3292e: fix: Fix changeset release workflow to automatically update pnpm-lock.yaml
  - Add version:packages script that updates lockfile after version bumps
  - Ensure Version Packages PR includes updated lockfile
  - This fixes CI failures on changeset-created PRs

- Updated dependencies [ea3292e]
  - @hugsylabs/hugsy-types@0.0.5

## 0.1.1

### Patch Changes

- 26cad30: feat: Improve error and log message formatting
  - Add emoji prefixes for clearer error (⚠️) and info (ℹ️) messages
  - Make console output more user-friendly and scannable

- Updated dependencies [26cad30]
  - @hugsylabs/hugsy-types@0.0.4

## 0.1.0

### Minor Changes

- 6c01877: feat: Add TypeScript type exports and async plugin support
  - Export Plugin and HugsyPlugin types from compiler
  - Support async transform functions in plugins
  - Remove statusLine config and backup file generation

### Patch Changes

- 00ba9d5: docs: Update README comparison table
  - Update config size comparison from "200+ lines" to "10 lines" for better clarity
  - Improve documentation accuracy

- e96a2f8: fix: update version script to include lockfile-only install
  - Fix changeset workflow by updating package.json version script
  - Ensures pnpm install --lockfile-only runs after version bumping

- dad9ae2: readme update
- Updated dependencies [6c01877]
- Updated dependencies [00ba9d5]
- Updated dependencies [e96a2f8]
- Updated dependencies [dad9ae2]
  - @hugsylabs/hugsy-types@0.0.3

## 0.0.2

### Patch Changes

- 5a4d1be: Initial setup for automated release workflow with changesets
  - Configure changesets for npm publishing
  - Add publish:ci script for GitHub Actions
  - Set packages to public access

- Updated dependencies [5a4d1be]
  - @hugsylabs/hugsy-types@0.0.2
