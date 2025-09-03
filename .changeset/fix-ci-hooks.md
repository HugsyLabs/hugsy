---
'@hugsylabs/hugsy': patch
---

Disable Git hooks in CI environment

- Add HUSKY=0 environment variable to disable Git hooks during CI releases
- This prevents test failures caused by the CI environment differences
- CI already runs tests separately, so pre-push hooks are redundant
