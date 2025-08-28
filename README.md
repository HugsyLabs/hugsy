# 🐧 Hugsy

> The ultimate configuration for Claude Code. Transform your AI coding agents into a team-aligned powerhouse.

[![CI](https://github.com/HugsyLab/hugsy/actions/workflows/ci.yml/badge.svg)](https://github.com/HugsyLab/hugsy/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg?style=flat)](https://pnpm.io/)

## What is Hugsy?

Hugsy is a configuration management system for Claude Code that enables teams to:

- 📝 **Define Claude's behavior** through declarative configuration files
- 🎯 **Standardize AI workflows** across your entire organization
- 🔧 **Extend functionality** through a robust plugin system
- 📦 **Share configurations** as reusable presets

It ensures your AI coding agents follow your team's standards, workflows, and best practices.

## Why Hugsy?

### The Problem
Every developer configures Claude Code differently. This leads to:
- Inconsistent AI behaviors across team members
- Repeated setup for common workflows
- Security risks from overly permissive settings
- Lost productivity from manual configuration

### The Solution
Hugsy provides a unified configuration system that:
- Compiles human-readable configs into Claude-compatible settings
- Enables configuration inheritance and composition
- Validates settings before deployment
- Shares best practices through presets

### Without Hugsy vs With Hugsy

|                    | Without Hugsy           | With Hugsy              |
|--------------------|-------------------------|-------------------------|
| Config size        | 200+ lines JSON         | 10 lines JSON           |
| Team consistency   | ❌ Manual per developer | ✅ Presets + Plugins    |
| Security           | ❌ Easy to miss         | ✅ Enforced rules       |
| Slash Commands     | ❌ Scattered files      | ✅ Centralized          |
| Maintenance        | ❌ Update everywhere    | ✅ Update once          |

## Features

### 🎯 Configuration Compiler
Transform simple `.hugsyrc.json` files into comprehensive Claude Code settings:

```json
{
  "extends": "@hugsylabs/hugsy-compiler/presets/development",
  "slashCommands": {
     "presets": ["slash-commands-common"]
  }
}
```

Compiles to a complete `.claude/settings.json` and `.claude/commands/` with all necessary configurations.

### 🔌 Plugin Architecture
Extend and customize Hugsy's behavior:

```javascript
// plugins/security-scanner.js
export default {
  name: 'security-scanner',
  transform(config) {
    // Add security restrictions to protect sensitive files
    const existingDeny = config.permissions?.deny || [];
    
    return {
      env: config.env,
      permissions: {
        allow: config.permissions?.allow,
        ask: config.permissions?.ask,
        deny: [
          ...existingDeny,           // Keep existing deny rules
          'Read(**/.env)',          // Block all .env files
          'Read(**/secrets/**)',    // Block all secrets directories
          'Read(**/*key*)',         // Block files containing 'key'
        ]
      },
      hooks: config.hooks,
      commands: config.commands
    };
  }
};
```

### 📦 Preset Ecosystem
Choose from built-in presets or create your own:

- **development** - Full-featured development environment
- **strict** - Maximum security and restrictions
- **recommended** - Balanced for most projects
- **showcase** - Demonstrates all capabilities

## Installation

```bash
# Global installation (recommended)
npm install -g @hugsylabs/hugsy

# Or per-project
npm install --save-dev @hugsylabs/hugsy
```

## Quick Start

### 1. Initialize your project

```bash
hugsy init
```

Choose a preset that matches your project type.

### 2. Customize your configuration

Edit `.hugsyrc.json`:

```json
{
  "extends": "@hugsylabs/hugsy-compiler/presets/development",
  "slashCommands": {
    "custom": "./.claude/commands/**/*.md"
  }
}
```

### 3. Compile and deploy

```bash
hugsy install
# This generates .claude/settings.json and copies slash commands to .claude/commands/
```

Your Claude Code configuration is now ready!

## Plugin Development

Hugsy plugins are ESM-only modules that transform configurations. 

### Basic Plugin Structure

```javascript
// my-plugin.js
export default {
  name: 'my-plugin',    // Required: unique identifier
  version: '1.0.0',     // Optional: plugin version
  
  transform(config) {   // Required: transform function
    return {
      ...config,
      env: {
        ...config.env,
        MY_VAR: 'value'
      }
    };
  }
};
```

**Note:** Add `"type": "module"` to your `package.json`. CommonJS (`module.exports`) is not supported.

### Plugin API

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | ✅ | Unique plugin identifier |
| `transform` | `function` | ✅ | Config transformation function |
| `version` | `string` | ❌ | Plugin version |
| `author` | `string` | ❌ | Plugin author |

### Best Practices

1. **Always return the complete config object**
2. **Preserve existing values using spread operators**
3. **Handle missing fields defensively**

Example:
```javascript
export default {
  name: 'security-plugin',
  transform(config) {
    // Defensive: handle missing permissions
    const currentDeny = config.permissions?.deny || [];
    
    return {
      ...config,  // Preserve all config
      permissions: {
        ...config.permissions,
        deny: [...currentDeny, 'Write(**/.env*)']
      }
    };
  }
};
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT

---

Made with ❤️ by the HugsyLabs Team