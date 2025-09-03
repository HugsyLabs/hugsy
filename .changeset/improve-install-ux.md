---
'@hugsylabs/hugsy': patch
---

Improve install command UX for existing settings

- Change error message to warning when .claude/settings.json exists
- Add interactive prompt asking user if they want to overwrite
- Preserve --force flag for non-interactive overwrite
- Better user experience with clear choices
