---
"@hugsylabs/hugsy-compiler": patch
---

Fix plugin loading in ESM environment

- Replace `require.resolve` with filesystem-based module resolution (ESM compatible)
- Support loading plugins from project's local node_modules
- Add createRequire as fallback for complex resolution scenarios
- Properly handle both ESM and CommonJS plugin entry points
- Enable global hugsy to load locally installed plugins

This fixes the issue where plugins installed with `hugsy install <plugin>` were not being loaded correctly.