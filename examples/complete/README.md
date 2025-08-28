# Hugsy Complete Example

This example demonstrates a typical Hugsy configuration for a development project, showcasing all major features.

## Features Demonstrated

### 1. Permission Management
- ✅ **Allow**: Read access, test/docs writing, safe commands
- 🚫 **Deny**: Production writes, dangerous commands
- Configuration in `.hugsyrc.json`

### 2. Plugins
- **Logger Plugin**: Example plugin that adds audit logging
- Transforms configuration dynamically
- Adds environment variables, permissions, and hooks
- Located in `plugins/logger-plugin.js`

### 3. Environment Variables
- Sets `NODE_ENV` and `PROJECT_NAME` for the Claude Code session
- Plugin can add additional env vars dynamically

### 4. Status Line
- Shows git status in the Claude Code status bar

### 5. Hooks
- Notifications when tools are allowed/denied
- Custom messages for specific actions
- Plugin can inject additional hooks

### 6. Slash Commands
- **Built-in presets**: Common development commands from `@hugsy/slash-commands-common`
- **Markdown files**: All project-specific commands organized in `project-commands/` directory
  - Each command is a separate `.md` file with optional frontmatter
  - Keeps `.hugsyrc.json` clean and focused

## Setup

```bash
# Install dependencies
pnpm install

# Install Hugsy configuration
pnpm run setup
```

## Project Structure

```
complete/
├── .hugsyrc.json          # Main Hugsy configuration (clean and simple)
├── plugins/               # Custom plugins
│   └── logger-plugin.js  # Example audit logging plugin
├── project-commands/      # Custom slash commands as markdown files
│   ├── debug.md          # Debug helper with argument support
│   ├── deploy.md         # Deployment steps
│   ├── refactor.md       # Refactoring checklist
│   ├── review.md         # Code review process
│   └── standup.md        # Daily standup template
├── package.json          # Project package file
└── README.md            # This file
```

## Generated Files

After running `pnpm run setup`, Hugsy will create:

```
.claude/
├── settings.json        # Compiled Claude Code settings
└── commands/           # Generated slash commands
    ├── deployment/     # Category folder
    │   └── deploy.md
    ├── development/    # Category folder
    │   ├── debug.md
    │   └── refactor.md
    ├── team/          # Category folder
    │   └── standup.md
    └── ... (other commands from presets)
```

## Available Slash Commands

After setup, you'll have access to these commands in Claude Code:

- `/deploy` - Deploy to staging environment
- `/review` - Start code review process
- `/standup` - Daily standup template
- `/debug [issue-type]` - Debug specific issues
- `/refactor` - Refactoring checklist
- Plus all commands from `@hugsy/slash-commands-common` preset

## Customization

### Configuration File
Modify `.hugsyrc.json` to:
- Add/remove permissions
- Change environment variables
- Update status line command
- Configure different hooks
- Add/remove command presets

### Custom Commands
Add new slash commands by creating `.md` files in `project-commands/`:
```markdown
---
description: Command description
category: category-name
argument-hint: [optional-args]
---

Your command content here
```

After making changes, run `pnpm run setup` again to update the configuration.