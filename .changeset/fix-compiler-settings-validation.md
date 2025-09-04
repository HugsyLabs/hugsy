---
"@hugsylabs/hugsy-compiler": patch
"@hugsylabs/hugsy-types": patch
"@hugsylabs/hugsy": patch
---

Fix Claude Code settings.json generation and validation

- Add required $schema field to generated settings.json
- Fix hooks format: convert simple format to nested format with proper type literals
- Fix matcher format: convert "Tool(args)" to "Tool" (Claude Code only supports tool-level matching)
- Add comprehensive validateSettings method for format validation
- Update StatusLineConfig to support both 'value' and 'text' fields
- Remove problematic external plugins with incorrect matcher formats from .hugsyrc.json
- Add extensive unit tests for compiler validation (141 tests)
- Update integration test snapshots for new $schema field