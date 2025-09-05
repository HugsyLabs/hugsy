---
'@hugsylabs/hugsy': minor
'@hugsylabs/hugsy-core': minor
'@hugsylabs/hugsy-ui': minor
---

Transform compiler package into modular core package

- **BREAKING**: Renamed `@hugsylabs/hugsy-compiler` to `@hugsylabs/hugsy-core`
- Created modular architecture with separate managers:
  - `InstallManager`: Handles writing compiled configuration to filesystem
  - `PackageManager`: Manages plugins and presets discovery/validation
  - `ConfigManager`: Handles configuration file operations
- UI no longer depends on CLI - both can work independently
- Added initialization wizard for UI first-time setup
- Fixed force install dialog detection logic
- Fixed all preset paths to use @hugsylabs organization name

**Migration Guide:**

- Update imports from `@hugsylabs/hugsy-compiler` to `@hugsylabs/hugsy-core`
- No changes needed for end users using the CLI
