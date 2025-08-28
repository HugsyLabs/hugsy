# @hugsylabs/hugsy-compiler

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
