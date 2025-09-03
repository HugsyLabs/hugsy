---
'@hugsylabs/hugsy-compiler': patch
'@hugsylabs/hugsy': patch
---

Fix test failures in CI environment

- Convert all relative plugin and preset paths to absolute paths in compiler tests
- This resolves file resolution issues that occur in CI environments
- Ensures consistent test behavior across local and CI environments
- Update CLI to use the fixed compiler version
