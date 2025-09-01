---
"@hugsylabs/hugsy": minor
---

Add package management capabilities

- `hugsy init` now automatically runs `install` (skip with `--no-install` flag)
- `hugsy install` supports package installation: `hugsy install @hugsy-plugins/xxx`
- `hugsy uninstall` supports dual functionality:
  - Without arguments: uninstalls Hugsy entirely
  - With arguments: removes specified packages from configuration
- Add smart package type detection (plugin vs preset)
- Support `--plugin` and `--preset` flags to explicitly specify package type