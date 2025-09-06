/**
 * @hugsylabs/hugsy-core - Core functionality for Hugsy
 *
 * This package provides the core components for managing Claude Code configurations:
 * - Compiler: Transforms .hugsyrc.json to Claude settings.json
 * - InstallManager: Handles installation of settings and commands
 * - PackageManager: Manages plugins and presets
 * - ConfigManager: Handles configuration file operations
 */

// Export Compiler and related types
export { Compiler, CompilerError, CompilerOptions } from './compiler/index.js';

// Export InstallManager and related types
export { InstallManager, InstallOptions, InstallResult } from './installer/index.js';

// Export PackageManager and related types
export {
  PackageManager,
  PackageInfo,
  PackageManagerType,
  InstallResult as PackageInstallResult,
} from './packages/index.js';

// Export ConfigManager and related types
export { ConfigManager, ConfigOptions, ValidationResult } from './config/index.js';

// Re-export types from @hugsylabs/hugsy-types for convenience
export type {
  HugsyConfig,
  ClaudeSettings,
  PermissionSettings,
  HookSettings,
  Plugin,
  Preset,
  StatusLineConfig,
  HookConfig,
  SlashCommand,
  SlashCommandsConfig,
} from '@hugsylabs/hugsy-types';

// Re-export Plugin type explicitly for plugin developers
export type { Plugin as HugsyPlugin } from '@hugsylabs/hugsy-types';
