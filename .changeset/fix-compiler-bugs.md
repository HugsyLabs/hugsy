---
'@hugsylabs/hugsy-compiler': patch
'@hugsylabs/hugsy-types': patch
---

fix: Fix multiple compiler bugs

- Fix inherited values (includeCoAuthoredBy, cleanupPeriodDays) becoming null
- Implement plugin validate function calls with error handling  
- Add env value type validation to reject non-string values
- Normalize uppercase field names (ENV→env, Permissions→permissions, etc)
- Add comprehensive tests for all bug fixes