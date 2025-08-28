---
description: Prepare a release
argument-hint: [version]
---

Prepare for releasing version $ARGUMENTS:

## Pre-release Checklist
1. Run all tests: `pnpm test`
2. Run lint check: `pnpm lint`
3. Build all packages: `pnpm build`
4. Update version numbers in package.json files
5. Update CHANGELOG.md with release notes

## Release Steps
1. Commit all changes
2. Create and push tag: `git tag v$ARGUMENTS`
3. Push to main branch
4. Create GitHub release

Note: Actual npm publish requires manual confirmation.