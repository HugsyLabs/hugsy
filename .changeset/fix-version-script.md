---
'@hugsylabs/hugsy': patch
'@hugsylabs/hugsy-compiler': patch
'@hugsylabs/hugsy-types': patch
---

fix: update version script to include lockfile-only install

- Fix changeset workflow by updating package.json version script
- Ensures pnpm install --lockfile-only runs after version bumping