---
"@hugsylabs/hugsy-compiler": patch
---

Fix slash commands and ESM import issues

- Fixed destructive build command that was removing all dist directories
- Fixed recursive dev command issue
- Fixed release command syntax (pnpm build → pnpm run build)
- Fixed ESM imports for glob and yaml packages to use named exports
- Ensured proper TypeScript declaration files generation