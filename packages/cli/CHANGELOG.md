# @hugsylabs/hugsy

## 0.0.5

### Patch Changes

- ea3292e: fix: Fix changeset release workflow to automatically update pnpm-lock.yaml
  - Add version:packages script that updates lockfile after version bumps
  - Ensure Version Packages PR includes updated lockfile
  - This fixes CI failures on changeset-created PRs

- Updated dependencies [ea3292e]
  - @hugsylabs/hugsy-compiler@0.1.2
  - @hugsylabs/hugsy-types@0.0.5

## 0.0.4

### Patch Changes

- 26cad30: feat: Improve error and log message formatting
  - Add emoji prefixes for clearer error (⚠️) and info (ℹ️) messages
  - Make console output more user-friendly and scannable

- Updated dependencies [26cad30]
  - @hugsylabs/hugsy-compiler@0.1.1
  - @hugsylabs/hugsy-types@0.0.4

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
- Updated dependencies [6c01877]
- Updated dependencies [00ba9d5]
- Updated dependencies [e96a2f8]
- Updated dependencies [dad9ae2]
  - @hugsylabs/hugsy-compiler@0.1.0
  - @hugsylabs/hugsy-types@0.0.3

## 0.0.2

### Patch Changes

- 5a4d1be: Initial setup for automated release workflow with changesets
  - Configure changesets for npm publishing
  - Add publish:ci script for GitHub Actions
  - Set packages to public access

- Updated dependencies [5a4d1be]
  - @hugsylabs/hugsy-compiler@0.0.2
  - @hugsylabs/hugsy-types@0.0.2
