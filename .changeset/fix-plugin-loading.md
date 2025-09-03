---
"@hugsylabs/hugsy-compiler": patch
---

Fix plugin loading errors and improve module resolution

- Fixed plugin loading to return null on failure instead of empty object
- Improved npm package resolution using require.resolve
- Added better error logging for debugging plugin loading issues
- Plugins that fail to load are now correctly excluded from the count