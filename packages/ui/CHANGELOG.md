# @hugsylabs/hugsy-ui

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
