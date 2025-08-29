---
'@hugsylabs/hugsy': patch
'@hugsylabs/hugsy-compiler': patch
'@hugsylabs/hugsy-types': patch
---

fix: Fix changeset release workflow to automatically update pnpm-lock.yaml

- Add version:packages script that updates lockfile after version bumps
- Ensure Version Packages PR includes updated lockfile
- This fixes CI failures on changeset-created PRs