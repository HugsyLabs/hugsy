# @hugsylabs/hugsy-ui

## 0.2.0

### Minor Changes

- c8e1197: Transform compiler package into modular core package
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

### Patch Changes

- Updated dependencies [c8e1197]
  - @hugsylabs/hugsy-core@0.2.0

## 0.1.1

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

- Updated dependencies [57f25ac]
  - @hugsylabs/hugsy-compiler@0.1.9
