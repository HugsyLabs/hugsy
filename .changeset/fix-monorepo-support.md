---
"@hugsylabs/hugsy": patch
---

Fix monorepo support for `hugsy install` command

- Automatically detect pnpm workspace and add `-w` flag when installing packages
- This fixes the issue where `hugsy install` would fail in monorepo projects with pnpm
- No longer requires users to configure `.npmrc` with `ignore-workspace-root-check=true`