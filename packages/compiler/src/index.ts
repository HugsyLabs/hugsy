/**
 * @hugsylabs/hugsy-compiler - Configuration compiler for Claude Code
 * Transforms simple .hugsyrc configurations into complete Claude settings.json
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import ora from 'ora';
import type {
  HugsyConfig,
  ClaudeSettings,
  PermissionSettings,
  HookSettings,
  Plugin,
  Preset,
  SlashCommand,
  SlashCommandsConfig,
  StatusLineConfig,
  HookConfig,
} from '@hugsylabs/hugsy-types';

export interface CompilerOptions {
  projectRoot?: string;
  verbose?: boolean;
  throwOnError?: boolean;
}

export class CompilerError extends Error {
  constructor(
    message: string,
    public details?: Record<string, string | number | boolean | string[]>
  ) {
    super(message);
    this.name = 'CompilerError';
  }
}

export class Compiler {
  private projectRoot: string;
  private presets = new Map<string, HugsyConfig>();
  private plugins = new Map<string, Plugin>();
  private presetsCache = new Map<string, HugsyConfig>();
  private compiledCommands = new Map<string, SlashCommand>();
  private options: CompilerOptions;

  constructor(optionsOrRoot?: CompilerOptions | string) {
    // Support both new signature (options object) and old signature (projectRoot string)
    if (typeof optionsOrRoot === 'string') {
      this.options = { projectRoot: optionsOrRoot };
      this.projectRoot = optionsOrRoot;
    } else {
      this.options = optionsOrRoot ?? {};
      this.projectRoot = this.options.projectRoot ?? process.cwd();
    }
  }

  /**
   * Validate generated settings.json format for Claude Code compatibility
   */
  public validateSettings(settings: ClaudeSettings): string[] {
    const errors: string[] = [];

    // Validate $schema field
    if (!settings.$schema) {
      errors.push('Missing required $schema field');
    } else if (settings.$schema !== 'https://json.schemastore.org/claude-code-settings.json') {
      errors.push(
        'Invalid $schema value, must be https://json.schemastore.org/claude-code-settings.json'
      );
    }

    // Validate permissions format
    if (settings.permissions) {
      const validPermissionPattern = /^[A-Z][a-zA-Z]*(\(.*\))?$/;

      ['allow', 'ask', 'deny'].forEach((type) => {
        const perms = settings.permissions?.[type as keyof PermissionSettings];
        if (perms && Array.isArray(perms)) {
          perms.forEach((perm) => {
            if (!validPermissionPattern.test(perm)) {
              errors.push(
                `Invalid permission format in ${type}: "${perm}". Must match Tool or Tool(pattern)`
              );
            }
          });
        }
      });
    }

    // Validate hooks format
    if (settings.hooks) {
      for (const [hookType, hookConfigs] of Object.entries(settings.hooks)) {
        if (!Array.isArray(hookConfigs)) {
          errors.push(`Hooks.${hookType} must be an array`);
          continue;
        }

        hookConfigs.forEach((hook, index) => {
          // Check if matcher is present
          if (!hook.matcher) {
            errors.push(`Hooks.${hookType}[${index}] missing required 'matcher' field`);
          } else {
            // Validate matcher format - should be tool name only, not with arguments
            if (hook.matcher.includes('(')) {
              errors.push(
                `Hooks.${hookType}[${index}].matcher "${hook.matcher}" should be tool name only (e.g., "Bash" not "Bash(git *)")`
              );
            }
          }

          // Check if hooks array is present
          if (!hook.hooks || !Array.isArray(hook.hooks)) {
            errors.push(`Hooks.${hookType}[${index}] missing required 'hooks' array`);
          } else {
            // Validate each hook in the array
            hook.hooks.forEach((h, hIndex) => {
              if (!h.type) {
                errors.push(
                  `Hooks.${hookType}[${index}].hooks[${hIndex}] missing required 'type' field`
                );
              } else if (h.type !== 'command') {
                errors.push(
                  `Hooks.${hookType}[${index}].hooks[${hIndex}].type must be "command", got "${String(h.type)}"`
                );
              }

              if (!h.command) {
                errors.push(
                  `Hooks.${hookType}[${index}].hooks[${hIndex}] missing required 'command' field`
                );
              }

              if (h.timeout !== undefined && typeof h.timeout !== 'number') {
                errors.push(
                  `Hooks.${hookType}[${index}].hooks[${hIndex}].timeout must be a number`
                );
              }
            });
          }
        });
      }
    }

    // Validate environment variables
    if (settings.env) {
      for (const [key, value] of Object.entries(settings.env)) {
        if (typeof value !== 'string') {
          errors.push(`Environment variable '${key}' must be a string, got ${typeof value}`);
        }
      }
    }

    // Validate statusLine
    if (settings.statusLine) {
      if (!settings.statusLine.type || !['command', 'static'].includes(settings.statusLine.type)) {
        errors.push(
          `statusLine.type must be 'command' or 'static', got '${settings.statusLine.type}'`
        );
      }

      if (settings.statusLine.type === 'command' && !settings.statusLine.command) {
        errors.push('statusLine.command is required when type is "command"');
      }

      if (settings.statusLine.type === 'static' && !settings.statusLine.value) {
        errors.push('statusLine.value is required when type is "static"');
      }
    }

    // Validate optional numeric fields
    if (
      settings.cleanupPeriodDays !== undefined &&
      typeof settings.cleanupPeriodDays !== 'number'
    ) {
      errors.push(`cleanupPeriodDays must be a number, got ${typeof settings.cleanupPeriodDays}`);
    }

    // Validate boolean fields
    if (
      settings.includeCoAuthoredBy !== undefined &&
      typeof settings.includeCoAuthoredBy !== 'boolean'
    ) {
      errors.push(
        `includeCoAuthoredBy must be a boolean, got ${typeof settings.includeCoAuthoredBy}`
      );
    }

    if (
      settings.enableAllProjectMcpServers !== undefined &&
      typeof settings.enableAllProjectMcpServers !== 'boolean'
    ) {
      errors.push(
        `enableAllProjectMcpServers must be a boolean, got ${typeof settings.enableAllProjectMcpServers}`
      );
    }

    // Validate array fields
    if (settings.enabledMcpjsonServers && !Array.isArray(settings.enabledMcpjsonServers)) {
      errors.push('enabledMcpjsonServers must be an array');
    }

    if (settings.disabledMcpjsonServers && !Array.isArray(settings.disabledMcpjsonServers)) {
      errors.push('disabledMcpjsonServers must be an array');
    }

    return errors;
  }

  /**
   * Main compile function - transforms .hugsyrc to Claude settings.json
   */
  async compile(config: HugsyConfig): Promise<ClaudeSettings> {
    this.log('Starting compilation...');

    // Check if config is an array (invalid)
    if (Array.isArray(config)) {
      throw new CompilerError('Configuration must be an object, not an array');
    }

    // Check if config is an object
    if (typeof config !== 'object' || config === null) {
      throw new CompilerError('Configuration must be an object');
    }

    // Sanitize configuration first (remove zero-width and control characters)
    config = this.sanitizeConfigValues(config);

    // Normalize field names (handle uppercase variants)
    config = this.normalizeConfig(config);

    // Validate configuration
    this.validateConfig(config);

    // Load extends (presets)
    if (config.extends) {
      const presetList = Array.isArray(config.extends) ? config.extends : [config.extends];
      this.log(`Loading ${presetList.length} preset(s): ${presetList.join(', ')}`);
      await this.loadPresets(config.extends);
    }

    // Load plugins and apply transformations
    let transformedConfig = { ...config };

    // Preserve inherited values from presets
    let inheritedValues: Partial<HugsyConfig> = {};
    for (const preset of this.presets.values()) {
      if (
        preset.includeCoAuthoredBy !== undefined &&
        inheritedValues.includeCoAuthoredBy === undefined
      ) {
        inheritedValues.includeCoAuthoredBy = preset.includeCoAuthoredBy;
      }
      if (
        preset.cleanupPeriodDays !== undefined &&
        inheritedValues.cleanupPeriodDays === undefined
      ) {
        inheritedValues.cleanupPeriodDays = preset.cleanupPeriodDays;
      }
    }

    // Merge inherited values into config if not already set
    if (
      transformedConfig.includeCoAuthoredBy === undefined &&
      inheritedValues.includeCoAuthoredBy !== undefined
    ) {
      transformedConfig.includeCoAuthoredBy = inheritedValues.includeCoAuthoredBy;
    }
    if (
      transformedConfig.cleanupPeriodDays === undefined &&
      inheritedValues.cleanupPeriodDays !== undefined
    ) {
      transformedConfig.cleanupPeriodDays = inheritedValues.cleanupPeriodDays;
    }

    if (config.plugins) {
      this.log(`Loading ${config.plugins.length} plugin(s): ${config.plugins.join(', ')}`);
      await this.loadPlugins(config.plugins);

      // Apply plugin transformations with progress tracking
      const transformSpinner =
        !this.options.verbose && this.plugins.size > 1
          ? ora('Applying plugin transformations...').start()
          : null;

      let pluginIndex = 0;
      for (const [pluginPath, plugin] of this.plugins.entries()) {
        pluginIndex++;

        if (transformSpinner) {
          transformSpinner.text = `Applying transformation ${pluginIndex}/${this.plugins.size}: ${plugin.name ?? pluginPath}`;
        }

        if (plugin.transform && typeof plugin.transform === 'function') {
          const before = {
            env: transformedConfig.env ? { ...transformedConfig.env } : undefined,
            permissions: transformedConfig.permissions
              ? { ...transformedConfig.permissions }
              : undefined,
          };

          const pluginName = plugin.name ?? pluginPath;

          try {
            // Support both sync and async transform functions
            const result = plugin.transform(transformedConfig);

            // Check if result is a Promise without using any
            if (
              result &&
              typeof result === 'object' &&
              'then' in result &&
              typeof result.then === 'function'
            ) {
              const awaitedResult = await result;
              // Check if the result is valid
              if (awaitedResult === undefined || awaitedResult === null) {
                throw new Error('Plugin transform returned undefined or null');
              }
              transformedConfig = awaitedResult;
            } else {
              // Check if the result is valid
              if (result === undefined || result === null) {
                throw new Error('Plugin transform returned undefined or null');
              }
              transformedConfig = result as HugsyConfig;
            }
            this.log(`[${pluginIndex}/${this.plugins.size}] Applying plugin: ${pluginName}`);

            // Log what changed
            if (before.env !== transformedConfig.env) {
              this.logChanges('env', before.env, transformedConfig.env);
            }
            if (before.permissions !== transformedConfig.permissions) {
              this.logChanges('permissions', before.permissions, transformedConfig.permissions);
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.warn(`Plugin '${pluginName}' transform failed: ${errorMsg}`);
            this.log(`⚠️  Plugin '${pluginName}' transform failed: ${errorMsg}`);
            this.log(`   Skipping this plugin and continuing...`);
            // Continue with unchanged config
          }
        }
      }

      if (transformSpinner) {
        transformSpinner.succeed(`Applied ${this.plugins.size} plugin transformation(s)`);
      }
    }

    // Compile slash commands
    const commands = await this.compileCommands(transformedConfig);

    // Build the final settings using transformed config
    const settings: ClaudeSettings = {
      $schema: 'https://json.schemastore.org/claude-code-settings.json',
      permissions: this.compilePermissions(transformedConfig),
      hooks: this.compileHooks(transformedConfig),
      env: this.compileEnvironment(transformedConfig),
      // Only include optional fields if they are explicitly set
      ...(transformedConfig.model !== undefined && {
        model: transformedConfig.model,
      }),
      ...(transformedConfig.statusLine !== undefined && {
        statusLine: this.validateStatusLine(transformedConfig.statusLine),
      }),
      ...(transformedConfig.includeCoAuthoredBy !== undefined && {
        includeCoAuthoredBy: transformedConfig.includeCoAuthoredBy,
      }),
      ...(transformedConfig.cleanupPeriodDays !== undefined && {
        cleanupPeriodDays: transformedConfig.cleanupPeriodDays,
      }),
    };

    // Store commands for later file generation
    this.compiledCommands = commands;

    // Add optional settings
    if (transformedConfig.apiKeyHelper) settings.apiKeyHelper = transformedConfig.apiKeyHelper;
    if (transformedConfig.awsAuthRefresh)
      settings.awsAuthRefresh = transformedConfig.awsAuthRefresh;
    if (transformedConfig.awsCredentialExport)
      settings.awsCredentialExport = transformedConfig.awsCredentialExport;
    if (transformedConfig.enableAllProjectMcpServers !== undefined) {
      settings.enableAllProjectMcpServers = transformedConfig.enableAllProjectMcpServers;
    }
    if (transformedConfig.enabledMcpjsonServers) {
      settings.enabledMcpjsonServers = transformedConfig.enabledMcpjsonServers;
    }
    if (transformedConfig.disabledMcpjsonServers) {
      settings.disabledMcpjsonServers = transformedConfig.disabledMcpjsonServers;
    }

    // Run plugin validations on the final configuration
    const validationErrors: string[] = [];
    for (const [pluginName, plugin] of this.plugins) {
      if (plugin.validate && typeof plugin.validate === 'function') {
        try {
          const errors = plugin.validate(transformedConfig);
          if (Array.isArray(errors) && errors.length > 0) {
            errors.forEach((error) => {
              validationErrors.push(`[${pluginName}] ${error}`);
            });
          }
        } catch (error) {
          this.log(`⚠️  Plugin '${pluginName}' validate function threw error: ${String(error)}`);
        }
      }
    }

    // Handle validation errors
    if (validationErrors.length > 0) {
      if (this.options.throwOnError) {
        throw new CompilerError('Configuration validation failed', { errors: validationErrors });
      } else {
        console.warn('⚠️  Configuration validation warnings:');
        validationErrors.forEach((error) => console.warn(`  - ${error}`));
      }
    }

    // Validate the generated settings
    const settingsValidationErrors = this.validateSettings(settings);
    if (settingsValidationErrors.length > 0) {
      if (this.options.throwOnError) {
        throw new CompilerError('Generated settings.json validation failed', {
          errors: settingsValidationErrors,
        });
      } else {
        console.warn('⚠️  Generated settings.json validation warnings:');
        settingsValidationErrors.forEach((error) => console.warn(`  - ${error}`));
      }
    }

    // Log compilation summary
    this.logCompilationSummary(settings);

    return settings;
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(config: HugsyConfig): void {
    // Check for unknown/invalid properties
    const validKeys = [
      'extends',
      'plugins',
      'env',
      'permissions',
      'hooks',
      'commands',
      'model',
      'apiKeyHelper',
      'cleanupPeriodDays',
      'includeCoAuthoredBy',
      'statusLine',
      'forceLoginMethod',
      'forceLoginOrgUUID',
      'enableAllProjectMcpServers',
      'enabledMcpjsonServers',
      'disabledMcpjsonServers',
      'awsAuthRefresh',
      'awsCredentialExport',
    ];

    for (const key of Object.keys(config)) {
      // Check for non-ASCII characters in field names
      // eslint-disable-next-line no-control-regex
      if (!/^[\x00-\x7F]+$/.test(key)) {
        this.handleError(
          `Invalid configuration field '${key}': field names must contain only ASCII characters`
        );
        continue;
      }

      // Check for zero-width or control characters
      // eslint-disable-next-line no-control-regex
      if (/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/.test(key)) {
        this.handleError(
          `Invalid configuration field '${key}': contains invisible or control characters`
        );
        continue;
      }

      if (!validKeys.includes(key)) {
        this.log(`⚠️  Warning: Unknown configuration property '${key}' will be ignored`);
      }
    }
    // Validate extends field
    if (config.extends !== undefined) {
      if (typeof config.extends !== 'string' && !Array.isArray(config.extends)) {
        this.handleError(`extends field must be a string or array of strings`, {
          field: 'extends',
          type: typeof config.extends,
        });
      }
      if (Array.isArray(config.extends)) {
        for (const item of config.extends) {
          if (typeof item !== 'string') {
            this.handleError(`extends field must be a string or array of strings`, {
              field: 'extends',
              invalidItem: typeof item,
            });
          }
        }
      }
    }

    // Validate permissions format
    if (config.permissions) {
      this.validatePermissions(config.permissions);
    }

    // Validate statusLine if present
    if (config.statusLine) {
      if (typeof config.statusLine !== 'object') {
        this.handleError(`Invalid statusLine: expected object, got ${typeof config.statusLine}`);
      }
      if (config.statusLine.type && !['command', 'static'].includes(config.statusLine.type)) {
        this.handleError(`Invalid statusLine.type: must be 'command' or 'static'`);
      }
    }

    // Validate model if present
    if (config.model && typeof config.model !== 'string') {
      this.handleError(`Invalid model: expected string, got ${typeof config.model}`);
    }

    // Validate cleanupPeriodDays if present
    if (config.cleanupPeriodDays !== undefined && typeof config.cleanupPeriodDays !== 'number') {
      this.handleError(
        `Invalid cleanupPeriodDays: expected number, got ${typeof config.cleanupPeriodDays}`,
        {
          suggestion:
            'cleanupPeriodDays should be a number representing days (e.g., 7 for one week)',
        }
      );
    }

    // Validate env values are strings
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        if (typeof value !== 'string') {
          this.handleError(`Invalid env value for '${key}': expected string, got ${typeof value}`, {
            value: JSON.stringify(value),
            suggestion:
              'Environment variables must be strings. If you need to pass complex data, use JSON.stringify()',
          });
        }
      }
    }
  }

  /**
   * Validate permission format - must be Tool(pattern) or Tool
   */
  private validatePermissions(permissions: Record<string, string[] | undefined>): void {
    const validPattern = /^[A-Z][a-zA-Z]*(\(.*\))?$/;

    const validateList = (list: string[], type: string) => {
      if (!Array.isArray(list)) return;

      const invalid = list.filter((p) => !validPattern.test(p));
      if (invalid.length > 0) {
        this.handleError(
          `Invalid permission format in ${type}: ${invalid.join(', ')}. Permissions must match pattern: Tool or Tool(pattern)`
        );
      }
    };

    if (permissions.allow) validateList(permissions.allow, 'allow');
    if (permissions.ask) validateList(permissions.ask, 'ask');
    if (permissions.deny) validateList(permissions.deny, 'deny');
  }

  /**
   * Validate and return statusLine configuration
   */
  private validateStatusLine(
    statusLine: StatusLineConfig | undefined
  ): StatusLineConfig | undefined {
    if (!statusLine) return undefined;

    if (typeof statusLine !== 'object' || statusLine === null) {
      this.handleError(`Invalid statusLine configuration`);
      return undefined;
    }

    return statusLine;
  }

  /**
   * Handle errors based on options
   */
  private handleError(message: string, details?: Record<string, string | number | boolean>): void {
    const error = new CompilerError(message, details);

    if (this.options.verbose) {
      console.error(`[Hugsy Compiler Error] ${message}`, details ?? '');
    }

    if (this.options.throwOnError) {
      throw error;
    }

    // Default: log error but continue with a clearer prefix
    console.error(`⚠️  ${message}`);
  }

  /**
   * Sanitize configuration values - remove zero-width and control characters
   */
  private sanitizeConfigValues<T>(obj: T): T {
    if (typeof obj === 'string') {
      // Remove zero-width and control characters from strings
      // eslint-disable-next-line no-control-regex
      return obj.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, '') as T;
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        obj[i] = this.sanitizeConfigValues(obj[i]);
      }
    } else if (obj && typeof obj === 'object' && obj !== null) {
      for (const key of Object.keys(obj)) {
        (obj as Record<string, unknown>)[key] = this.sanitizeConfigValues(
          (obj as Record<string, unknown>)[key]
        );
      }
    }

    return obj;
  }

  /**
   * Log verbose messages
   */
  private log(message: string): void {
    if (this.options.verbose) {
      console.log(`ℹ️  [Hugsy Compiler] ${message}`);
    }
  }

  /**
   * Log changes made by plugins
   */
  private logChanges(
    field: string,
    before: Record<string, string | string[] | undefined> | undefined,
    after: Record<string, string | string[] | undefined> | undefined
  ): void {
    if (!this.options.verbose) return;

    if (
      field === 'env' &&
      before &&
      after &&
      typeof before === 'object' &&
      typeof after === 'object' &&
      !Array.isArray(before) &&
      !Array.isArray(after)
    ) {
      const changes: string[] = [];
      const beforeObj = before as Record<string, string | string[]>;
      const afterObj = after as Record<string, string | string[]>;

      // Check for new keys
      for (const key in afterObj) {
        if (!(key in beforeObj)) {
          changes.push(`  + ${key}: ${String(afterObj[key])}`);
        } else if (beforeObj[key] !== afterObj[key]) {
          changes.push(`  ~ ${key}: ${String(beforeObj[key])} → ${String(afterObj[key])}`);
        }
      }

      // Check for removed keys
      for (const key in beforeObj) {
        if (!(key in afterObj)) {
          changes.push(`  - ${key}`);
        }
      }

      if (changes.length > 0) {
        this.log(`  Modified ${field}:`);
        changes.forEach((change) => this.log(change));
      }
    } else if (
      field === 'permissions' &&
      before &&
      after &&
      typeof before === 'object' &&
      typeof after === 'object' &&
      !Array.isArray(before) &&
      !Array.isArray(after)
    ) {
      const compareArrays = (type: string, beforeArr: string[] = [], afterArr: string[] = []) => {
        const added = afterArr.filter((p) => !beforeArr.includes(p));
        const removed = beforeArr.filter((p) => !afterArr.includes(p));

        if (added.length > 0) {
          this.log(`  + ${type}: ${added.join(', ')}`);
        }
        if (removed.length > 0) {
          this.log(`  - ${type}: ${removed.join(', ')}`);
        }
      };

      const beforePerms = before as Record<string, string[]>;
      const afterPerms = after as Record<string, string[]>;
      compareArrays('allow', beforePerms.allow, afterPerms.allow);
      compareArrays('deny', beforePerms.deny, afterPerms.deny);
      compareArrays('ask', beforePerms.ask, afterPerms.ask);
    }
  }

  /**
   * Log compilation summary
   */
  private logCompilationSummary(settings: ClaudeSettings): void {
    if (!this.options.verbose) return;

    this.log('\n=== Compilation Summary ===');

    // Presets summary
    if (this.presets.size > 0) {
      const presetNames = Array.from(this.presets.keys());
      this.log(`Loaded ${this.presets.size} preset(s): ${presetNames.join(', ')}`);
    }

    // Plugins summary
    if (this.plugins.size > 0) {
      this.log(`Applied ${this.plugins.size} plugin(s) in order:`);
      let index = 1;
      for (const [path, plugin] of this.plugins.entries()) {
        const name = plugin.name ?? path;
        this.log(`  ${index}. ${name}`);
        index++;
      }
    }

    // Permissions summary
    const allowCount = settings.permissions?.allow?.length ?? 0;
    const denyCount = settings.permissions?.deny?.length ?? 0;
    const askCount = settings.permissions?.ask?.length ?? 0;
    this.log(`Final permissions: ${allowCount} allow, ${denyCount} deny, ${askCount} ask`);

    // Environment variables summary
    const envCount = Object.keys(settings.env ?? {}).length;
    if (envCount > 0) {
      this.log(`Environment variables: ${envCount} defined`);
    }

    // Hooks summary
    if (settings.hooks && Object.keys(settings.hooks).length > 0) {
      const hookTypes = Object.keys(settings.hooks);
      this.log(`Hooks configured: ${hookTypes.join(', ')}`);
    }

    this.log('=========================\n');
  }

  /**
   * Compile permissions from presets, plugins, and user config
   */
  private compilePermissions(config: HugsyConfig): PermissionSettings {
    const permissions: PermissionSettings = {
      allow: [],
      ask: [],
      deny: [],
    };

    // Collect from presets
    for (const preset of this.presets.values()) {
      if (preset.permissions) {
        permissions.allow.push(...(preset.permissions.allow ?? []));
        permissions.ask.push(...(preset.permissions.ask ?? []));
        permissions.deny.push(...(preset.permissions.deny ?? []));
      }
    }

    // Collect from plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.permissions) {
        permissions.allow.push(...(plugin.permissions.allow ?? []));
        permissions.ask.push(...(plugin.permissions.ask ?? []));
        permissions.deny.push(...(plugin.permissions.deny ?? []));
      }
    }

    // Apply user config (overrides)
    if (config.permissions) {
      if (config.permissions.allow) {
        permissions.allow.push(...config.permissions.allow);
      }
      if (config.permissions.ask) {
        permissions.ask.push(...config.permissions.ask);
      }
      if (config.permissions.deny) {
        permissions.deny.push(...config.permissions.deny);
      }
    }

    // Remove duplicates
    permissions.allow = [...new Set(permissions.allow)];
    permissions.ask = [...new Set(permissions.ask)];
    permissions.deny = [...new Set(permissions.deny)];

    // Handle conflicts: deny > ask > allow
    this.resolvePermissionConflicts(permissions);

    return permissions;
  }

  /**
   * Compile hooks from presets, plugins, and user config
   */
  private compileHooks(config: HugsyConfig): HookSettings {
    const hooks: HookSettings = {};

    // Collect from presets
    for (const preset of this.presets.values()) {
      if (preset.hooks) {
        this.mergeHooks(hooks, preset.hooks);
      }
    }

    // Collect from plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks) {
        this.mergeHooks(hooks, plugin.hooks);
      }
    }

    // Apply user config
    if (config.hooks) {
      this.mergeHooks(hooks, config.hooks);
    }

    // Convert all hooks to Claude Code expected format
    return this.normalizeHooksForClaude(hooks);
  }

  /**
   * Convert hooks to Claude Code expected format
   * Transforms simple {matcher, command} format to {matcher, hooks: [{type, command, timeout}]}
   * IMPORTANT: Merges all hooks with the same matcher into a single entry per Claude Code docs
   * IMPORTANT: Converts "Tool(args)" format to just "Tool" as Claude Code only supports tool-level matching
   */
  private normalizeHooksForClaude(hooks: HookSettings): HookSettings {
    const normalized: HookSettings = {};

    for (const [hookType, hookConfigs] of Object.entries(hooks)) {
      if (!hookConfigs) continue;

      const hookArray = Array.isArray(hookConfigs) ? hookConfigs : [hookConfigs];

      // Use a Map to group hooks by matcher
      const matcherGroups = new Map<
        string,
        { type: 'command'; command: string; timeout: number }[]
      >();

      for (const hook of hookArray) {
        if (typeof hook === 'string') {
          // String hook - shouldn't happen but handle it
          continue;
        }

        let matcher = '*'; // Default matcher for all tools
        let commands: { type: 'command'; command: string; timeout: number }[] = [];

        // Check if it's already in correct format with hooks array
        if (hook.hooks && Array.isArray(hook.hooks)) {
          matcher = this.normalizeMatcherFormat(hook.matcher ?? '*');
          commands = hook.hooks.map((h) => {
            if (typeof h === 'object' && 'command' in h) {
              return {
                type: 'command' as const,
                command: h.command,
                timeout: h.timeout ?? 3000,
              };
            }
            // If it's already properly formatted, keep it
            return h as { type: 'command'; command: string; timeout: number };
          });
        } else if (hook.command) {
          // Simple format - convert to Claude Code format
          matcher = this.normalizeMatcherFormat(hook.matcher ?? '*');
          commands = [
            {
              type: 'command' as const,
              command: hook.command,
              timeout: hook.timeout ?? 3000,
            },
          ];
        }

        // Add commands to the matcher group
        if (!matcherGroups.has(matcher)) {
          matcherGroups.set(matcher, []);
        }
        matcherGroups.get(matcher)!.push(...commands);
      }

      // Convert the Map to the final array format
      normalized[hookType] = Array.from(matcherGroups.entries()).map(([matcher, commands]) => ({
        matcher,
        hooks: commands,
      }));
    }

    return normalized;
  }

  /**
   * Normalize matcher format from "Tool(args)" to "Tool"
   * Claude Code only supports tool-level matching, not argument patterns
   */
  private normalizeMatcherFormat(matcher: string): string {
    // Handle common patterns
    if (matcher === '.*' || matcher === '') {
      return '*'; // Use * for all tools per Claude Code docs
    }

    // Extract tool name from "Tool(args)" format
    const regex = /^([A-Za-z]+)\(/;
    const match = regex.exec(matcher);
    if (match) {
      return match[1]; // Return just the tool name
    }

    // If it's already a simple tool name or pattern, return as is
    return matcher;
  }

  /**
   * Compile slash commands from presets, plugins, and user config
   */
  private async compileCommands(config: HugsyConfig): Promise<Map<string, SlashCommand>> {
    const commands = new Map<string, SlashCommand>();

    // 1. Collect from presets (lowest priority)
    for (const preset of this.presets.values()) {
      if (preset.commands) {
        // Presets might have different command formats
        if (Array.isArray(preset.commands)) {
          // Skip array format - these are preset references, not actual commands
          continue;
        } else if ('commands' in preset.commands) {
          // SlashCommandsConfig with nested commands
          const cmdConfig = preset.commands;
          if (cmdConfig.commands) {
            this.mergeCommands(commands, cmdConfig.commands);
          }
        } else {
          // Direct command mapping (shouldn't happen but handle it)
          this.mergeCommands(commands, preset.commands as Record<string, string | SlashCommand>);
        }
      }
    }

    // 2. Collect from plugins (medium priority)
    for (const plugin of this.plugins.values()) {
      if (plugin.commands) {
        this.mergeCommands(commands, plugin.commands);
      }
    }

    // 3. Process user config (highest priority)
    if (config.commands) {
      await this.processUserCommands(commands, config.commands);
    }

    this.log(`Compiled ${commands.size} slash command(s)`);
    return commands;
  }

  /**
   * Process user command configuration
   */
  private async processUserCommands(
    commands: Map<string, SlashCommand>,
    userCommands: SlashCommandsConfig | string[]
  ): Promise<void> {
    // Handle shorthand array syntax (list of preset names)
    if (Array.isArray(userCommands)) {
      for (const presetName of userCommands) {
        const preset = await this.loadModule<Preset>(presetName, 'command-preset');
        if (preset?.commands) {
          this.mergeCommands(commands, preset.commands);
        }
      }
      return;
    }

    // Handle full config object
    const config = userCommands;

    // Load command presets
    if (config.presets) {
      for (const presetName of config.presets) {
        const preset = await this.loadModule<Preset>(presetName, 'command-preset');
        if (preset?.commands) {
          this.mergeCommands(commands, preset.commands);
        }
      }
    }

    // Load command files (glob patterns)
    if (config.files) {
      await this.loadCommandFiles(commands, config.files);
    }

    // Apply direct command definitions (highest priority)
    if (config.commands) {
      this.mergeCommands(commands, config.commands);
    }
  }

  /**
   * Load commands from local markdown files
   */
  private async loadCommandFiles(
    commands: Map<string, SlashCommand>,
    patterns: string[]
  ): Promise<void> {
    try {
      // Dynamic import of glob module
      const { glob } = await import('glob');

      for (const pattern of patterns) {
        const files = await glob(pattern, { cwd: this.projectRoot });

        for (const file of files) {
          // Skip files without extensions (README, LICENSE, etc.)
          if (!file.includes('.')) {
            this.log(`Skipping file without extension: ${file}`);
            continue;
          }

          // Only process markdown files
          if (!/\.(md|markdown)$/i.test(file)) {
            this.log(`Skipping non-markdown file: ${file}`);
            continue;
          }

          const fullPath = resolve(this.projectRoot, file);
          if (existsSync(fullPath)) {
            const content = readFileSync(fullPath, 'utf-8');
            const commandName = this.extractCommandName(file);

            this.log(`Loading command from ${file}`);
            this.log(`Content preview: ${content.substring(0, 150).replace(/\n/g, '\\n')}`);

            // Parse frontmatter if present
            const command = this.parseMarkdownCommand(content);

            // Preserve case in command names (use original case as key)
            const commandKey = commandName; // Keep original case
            commands.set(commandKey, command);

            this.log(
              `Loaded command '${commandKey}': argumentHint='${command.argumentHint}', category='${command.category}', description='${command.description}'`
            );
          }
        }
      }
    } catch (error) {
      this.log(
        `Failed to load command files: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Extract command name from file path
   */
  private extractCommandName(filePath: string): string {
    // Remove extension and get basename
    const base = filePath.replace(/\.(md|markdown)$/i, '');
    const parts = base.split('/');
    // Keep original case of the command name
    return parts[parts.length - 1];
  }

  /**
   * Parse markdown command file with optional frontmatter
   */
  private parseMarkdownCommand(content: string): SlashCommand {
    // Simple frontmatter parsing (between --- lines)
    const frontmatterMatch = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(content);

    if (frontmatterMatch) {
      try {
        // Parse YAML frontmatter
        const frontmatter = this.parseSimpleYaml(frontmatterMatch[1]);
        const commandContent = frontmatterMatch[2].trim();

        this.log(`Parsed frontmatter: ${JSON.stringify(frontmatter)}`);

        const result = {
          content: commandContent,
          description:
            typeof frontmatter.description === 'string' ? frontmatter.description : undefined,
          category: typeof frontmatter.category === 'string' ? frontmatter.category : undefined,
          argumentHint:
            typeof frontmatter.argumentHint === 'string'
              ? frontmatter.argumentHint
              : typeof frontmatter['argument-hint'] === 'string'
                ? frontmatter['argument-hint']
                : Array.isArray(frontmatter['argument-hint']) &&
                    frontmatter['argument-hint'].length === 1
                  ? `[${frontmatter['argument-hint'][0]}]`
                  : undefined,
          model: typeof frontmatter.model === 'string' ? frontmatter.model : undefined,
          allowedTools: Array.isArray(frontmatter.allowedTools)
            ? frontmatter.allowedTools
            : Array.isArray(frontmatter['allowed-tools'])
              ? frontmatter['allowed-tools']
              : undefined,
        };

        this.log(
          `Created command object: argumentHint='${result.argumentHint}', from frontmatter['argument-hint']='${JSON.stringify(frontmatter['argument-hint'])}'`
        );

        return result;
      } catch {
        // If frontmatter parsing fails, treat entire content as command
      }
    }

    // No frontmatter, use entire content
    return {
      content: content.trim(),
      category: undefined,
    };
  }

  /**
   * Simple YAML parser for frontmatter
   */
  private parseSimpleYaml(yaml: string): Record<string, string | string[]> {
    const result: Record<string, string | string[]> = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
      const match = /^(\w[-\w]*)\s*:\s*(.*)$/.exec(line);
      if (match) {
        const key = match[1];
        let value = match[2].trim();

        // Handle arrays (simple case)
        if (value.startsWith('[') && value.endsWith(']')) {
          const arrayValue = value
            .slice(1, -1)
            .split(',')
            .map((s) => s.trim());
          result[key] = arrayValue;
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Merge commands into the target map
   */
  private mergeCommands(
    target: Map<string, SlashCommand>,
    source: Record<string, string | SlashCommand>
  ): void {
    for (const [name, command] of Object.entries(source)) {
      if (typeof command === 'string') {
        target.set(name, { content: command });
      } else {
        target.set(name, command);
      }
      this.log(`Added/updated command: ${name}`);
    }
  }

  /**
   * Get compiled commands (for use by CLI)
   */
  public getCompiledCommands(): Map<string, SlashCommand> {
    return this.compiledCommands;
  }

  /**
   * Compile environment variables
   * Merge strategy: presets < plugins < user config (later overrides earlier)
   * All values are converted to strings as required by Claude settings
   */
  private compileEnvironment(config: HugsyConfig): Record<string, string> {
    const env: Record<string, string> = {};

    // 1. Collect from presets (lowest priority)
    for (const preset of this.presets.values()) {
      if (preset.env) {
        for (const [key, value] of Object.entries(preset.env)) {
          // Validation will catch non-string values
          env[key] = value;
        }
        this.log(`Applied env from preset: ${JSON.stringify(preset.env)}`);
      }
    }

    // 2. Collect from plugins (medium priority)
    for (const plugin of this.plugins.values()) {
      if (plugin.env) {
        for (const [key, value] of Object.entries(plugin.env)) {
          // Validation will catch non-string values
          env[key] = value;
        }
        this.log(`Applied env from plugin: ${JSON.stringify(plugin.env)}`);
      }
    }

    // 3. Apply user config (highest priority)
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        // Validation will catch non-string values
        env[key] = value;
      }
      this.log(`Applied env from user config: ${JSON.stringify(config.env)}`);
    }

    return env;
  }

  /**
   * Load presets (extends) - recursively loads nested extends with progress tracking
   */
  private async loadPresets(extends_: string | string[]): Promise<void> {
    const presetNames = Array.isArray(extends_) ? extends_ : [extends_];
    const useSpinner = !this.options.verbose && presetNames.length > 1;
    const spinner = useSpinner ? ora('Loading presets...').start() : null;

    for (let i = 0; i < presetNames.length; i++) {
      const presetName = presetNames[i];

      if (spinner) {
        spinner.text = `Loading preset ${i + 1}/${presetNames.length}: ${presetName}`;
      }

      await this.loadPresetRecursive(presetName);
    }

    if (spinner) {
      spinner.succeed(`Loaded ${presetNames.length} preset(s)`);
    }
  }

  /**
   * Recursively load a preset and its extends
   */
  private async loadPresetRecursive(
    presetName: string,
    visitedPresets = new Set<string>()
  ): Promise<void> {
    // Detect circular dependencies
    if (visitedPresets.has(presetName)) {
      const cycle = Array.from(visitedPresets).concat(presetName).join(' -> ');
      throw new CompilerError(`Circular dependency detected: ${cycle}`);
    }

    // If already loaded successfully, skip
    if (this.presets.has(presetName)) {
      return;
    }

    // Mark as visiting to detect circular dependencies
    visitedPresets.add(presetName);

    const preset = await this.loadModule<Preset>(presetName, 'preset');
    if (preset && Object.keys(preset).length > 0) {
      // First, load any presets this preset extends
      const presetWithExtends = preset as HugsyConfig;
      if (presetWithExtends.extends) {
        const extends_ = Array.isArray(presetWithExtends.extends)
          ? presetWithExtends.extends
          : [presetWithExtends.extends];
        for (const extendName of extends_) {
          await this.loadPresetRecursive(extendName, new Set(visitedPresets));
        }
      }

      // Normalize preset config fields (handle uppercase variants)
      const normalizedPreset = this.normalizeConfig(preset);

      // Then add this preset (so it overrides its parents)
      this.presets.set(presetName, normalizedPreset as Preset);
      this.log(`Successfully loaded preset: ${presetName}`);
    } else {
      this.log(`Failed to load preset: ${presetName}`);
    }
  }

  /**
   * Load plugins with progress tracking
   */
  private async loadPlugins(plugins: string[]): Promise<void> {
    const useSpinner = !this.options.verbose && plugins.length > 1;
    const spinner = useSpinner ? ora('Loading plugins...').start() : null;
    let loadedCount = 0;

    for (let i = 0; i < plugins.length; i++) {
      const pluginName = plugins[i];

      if (spinner) {
        spinner.text = `Loading plugin ${i + 1}/${plugins.length}: ${pluginName}`;
      }

      this.log(`Loading plugin: ${pluginName}`);
      const plugin = await this.loadModule<Plugin>(pluginName, 'plugin');

      if (plugin) {
        this.plugins.set(pluginName, plugin);
        const name = plugin.name ?? pluginName;
        this.log(`  ✓ Loaded plugin: ${name}`);
        if (plugin.transform) {
          this.log(`    Has transform function`);
        }
        loadedCount++;
      } else {
        this.log(`  ✗ Failed to load plugin: ${pluginName}`);
        // Provide detailed warning for plugin loading failures
        if (pluginName.startsWith('./') || pluginName.startsWith('../')) {
          const fullPath = resolve(this.projectRoot, pluginName);
          this.log(`    ⚠️  Warning: Plugin file not found or failed to load`);
          this.log(`    Expected location: ${fullPath}`);
          if (
            !existsSync(fullPath) &&
            !existsSync(fullPath + '.js') &&
            !existsSync(fullPath + '.mjs')
          ) {
            this.log(`    Suggestion: Check if the file exists and the path is correct`);
          }
        }

        if (spinner) {
          spinner.warn(`Failed to load plugin: ${pluginName}`);
        }
      }
    }

    if (spinner) {
      if (loadedCount === plugins.length) {
        spinner.succeed(`Loaded ${loadedCount} plugin(s)`);
      } else {
        spinner.warn(`Loaded ${loadedCount}/${plugins.length} plugin(s)`);
      }
    }
  }

  /**
   * Load a module (preset or plugin)
   */
  private async loadModule<T>(moduleName: string, type: string): Promise<T | null> {
    this.log(`Loading ${type}: ${moduleName}`);

    // Check cache for presets
    if (type === 'preset' && this.presetsCache.has(moduleName)) {
      this.log(`Using cached preset: ${moduleName}`);
      return this.presetsCache.get(moduleName) as T;
    }

    // Handle @hugsylabs/hugsy-compiler/* presets (built-in presets)
    // Also support legacy @hugsy/* for backward compatibility
    if (moduleName.startsWith('@hugsylabs/hugsy-compiler/') || moduleName.startsWith('@hugsy/')) {
      const presetName = moduleName
        .replace('@hugsylabs/hugsy-compiler/presets/', '')
        .replace('@hugsylabs/hugsy-compiler/', '')
        .replace('@hugsy/', '');
      const builtinPath = resolve(
        this.projectRoot,
        'packages',
        'compiler',
        'presets',
        `${presetName}.json`
      );

      // Try to find in node_modules first (for installed packages)
      // Then try local development path
      const possiblePaths = [
        // For @hugsylabs/hugsy-compiler package
        resolve(
          this.projectRoot,
          'node_modules',
          '@hugsylabs',
          'hugsy-compiler',
          'presets',
          `${presetName}.json`
        ),
        resolve(
          this.projectRoot,
          'node_modules',
          '@hugsylabs',
          'hugsy-compiler',
          'dist',
          'presets',
          `${presetName}.json`
        ),
        // For legacy @hugsy package
        resolve(this.projectRoot, 'node_modules', moduleName, 'index.json'),
        resolve(this.projectRoot, 'node_modules', moduleName, 'preset.json'),
        // Local development paths
        builtinPath,
        resolve(dirname(fileURLToPath(import.meta.url)), '..', 'presets', `${presetName}.json`),
      ];

      for (const path of possiblePaths) {
        if (existsSync(path)) {
          try {
            this.log(`Found built-in ${type} at: ${path}`);
            const content = readFileSync(path, 'utf-8');
            const result = JSON.parse(content) as T;

            // Cache if preset
            if (type === 'preset') {
              this.presetsCache.set(moduleName, result as HugsyConfig);
            }

            return result;
          } catch (error) {
            this.log(
              `Failed to load from ${path}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }

      // If not found, log and return empty config
      this.log(`Built-in ${type} '${moduleName}' not found`);
      return {} as T;
    }

    // Handle local files (relative or absolute paths)
    if (moduleName.startsWith('./') || moduleName.startsWith('../') || moduleName.startsWith('/')) {
      const modulePath = moduleName.startsWith('/')
        ? moduleName
        : resolve(this.projectRoot, moduleName);

      // Try different extensions
      const extensions = ['.js', '.mjs', '/index.js', '/index.mjs', '.json'];
      for (const ext of extensions) {
        const fullPath =
          modulePath.endsWith('.js') || modulePath.endsWith('.mjs') || modulePath.endsWith('.json')
            ? modulePath
            : modulePath + ext;

        if (existsSync(fullPath)) {
          try {
            this.log(`Found ${type} at: ${fullPath}`);

            if (fullPath.endsWith('.json')) {
              const content = readFileSync(fullPath, 'utf-8');
              const result = JSON.parse(content) as T;

              // Cache if preset
              if (type === 'preset') {
                this.presetsCache.set(moduleName, result as HugsyConfig);
              }

              return result;
            } else {
              const module = await import(pathToFileURL(fullPath).href);
              const result = (module.default ?? module) as T;

              // Cache if preset
              if (type === 'preset') {
                this.presetsCache.set(moduleName, result as HugsyConfig);
              }

              return result;
            }
          } catch (error) {
            const errorMsg = `Failed to load ${type} ${moduleName}: ${error instanceof Error ? error.message : String(error)}`;
            this.handleError(
              errorMsg,
              error instanceof Error ? { error: error.message } : undefined
            );
            return null;
          }
        }
      }

      // Module not found - log warning and continue gracefully
      const checkedPaths = [];
      const extensionsToCheck = ['.js', '.mjs', '/index.js', '/index.mjs', '.json'];
      const basePath = moduleName.startsWith('/')
        ? moduleName
        : resolve(this.projectRoot, moduleName);

      for (const ext of extensionsToCheck) {
        const fullPath =
          basePath.endsWith('.js') || basePath.endsWith('.mjs') || basePath.endsWith('.json')
            ? basePath
            : basePath + ext;
        checkedPaths.push(fullPath);
      }

      // Log warning instead of error for graceful handling
      console.warn(`${type} '${moduleName}' not found`);

      if (this.options.verbose) {
        this.log(`⚠️  ${type} loading failed: ${moduleName}`);
        this.log(`   Checked locations: ${checkedPaths.join(', ')}`);
        if (type === 'plugin') {
          this.log(`   Ensure the plugin file exists and exports a valid plugin object`);
        } else if (type === 'preset') {
          this.log(`   Ensure the preset file exists and contains valid configuration`);
        }
      }

      // Return appropriate empty value to continue compilation
      return type === 'preset' ? ({} as T) : null;
    }

    // Handle npm packages
    try {
      let modulePath: string;

      // First, check if module exists in project's node_modules
      const localModulePath = join(this.projectRoot, 'node_modules', moduleName);

      if (existsSync(localModulePath)) {
        // Module found in local node_modules
        const packageJsonPath = join(localModulePath, 'package.json');
        let entryPoint = 'index.js';

        if (existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            // Support both ESM and CommonJS entry points
            entryPoint = packageJson.module ?? packageJson.main ?? 'index.js';
          } catch (err) {
            this.log(`Failed to parse package.json for ${moduleName}: ${String(err)}`);
          }
        }

        const fullPath = join(localModulePath, entryPoint);
        modulePath = pathToFileURL(fullPath).href;
        this.log(`Found ${type} in local node_modules: ${fullPath}`);
      } else {
        // Try using createRequire for more robust resolution
        try {
          const { createRequire } = await import('module');
          const require = createRequire(join(this.projectRoot, 'package.json'));
          const resolvedPath = require.resolve(moduleName);
          modulePath = pathToFileURL(resolvedPath).href;
          this.log(`Resolved ${type} via createRequire: ${resolvedPath}`);
        } catch {
          // Fall back to direct import (for global packages)
          modulePath = moduleName;
          this.log(`${type} not found locally, trying direct import: ${moduleName}`);
        }
      }

      this.log(`Attempting to import ${type} from: ${modulePath}`);
      const module = await import(modulePath);
      const result = (module.default ?? module) as T;

      // Cache if preset
      if (type === 'preset') {
        this.presetsCache.set(moduleName, result as HugsyConfig);
      }

      return result;
    } catch (error) {
      // More detailed error logging for debugging
      if (this.options.verbose) {
        this.log(`⚠️  Failed to load ${type}: ${moduleName}`);
        this.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
        if (type === 'plugin' && moduleName.startsWith('@hugsylabs/')) {
          this.log(`   Try: npm install ${moduleName} or pnpm add ${moduleName}`);
        }
      } else {
        console.warn(`⚠️  ${type} '${moduleName}' not found or failed to load`);
      }

      // Return null for plugins to indicate failure, empty object for presets
      return type === 'plugin' ? null : ({} as T);
    }
  }

  /**
   * Merge hook configurations
   * Deduplication based on globs and hook commands
   */
  private mergeHooks(target: HookSettings, source: HookSettings): void {
    for (const [hookType, hookConfig] of Object.entries(source)) {
      if (!target[hookType]) {
        target[hookType] = [];
      }

      const targetHooks = target[hookType] as HookConfig[];
      const sourceHooks = Array.isArray(hookConfig) ? hookConfig : [hookConfig];

      // Add hooks, avoiding duplicates based on globs and commands
      for (const hook of sourceHooks) {
        // Generate unique key for deduplication based on globs and hook commands
        const getHookKey = (h: HookConfig | string): string => {
          if (typeof h === 'string') {
            return h;
          }
          const hookObj = h;
          if (hookObj.matcher && hookObj.hooks) {
            // This is a hook entry with matcher and hooks array
            const matcher = hookObj.matcher;
            const commands =
              hookObj.hooks
                ?.map((cmd) => (typeof cmd === 'object' ? (cmd.command ?? '') : String(cmd)))
                .sort()
                .join(',') ?? '';
            return `${matcher}:${commands}`;
          } else if (hookObj.command) {
            // Simple command hook
            return hookObj.command;
          }
          return JSON.stringify(h);
        };

        const hookKey = getHookKey(hook);
        const exists = targetHooks.some((h) => getHookKey(h) === hookKey);

        if (!exists) {
          targetHooks.push(hook);
          this.log(`Added hook: ${hookKey}`);
        } else {
          this.log(`Skipped duplicate hook: ${hookKey}`);
        }
      }
    }
  }

  /**
   * Normalize config field names (handle uppercase variants)
   */
  private normalizeConfig(config: HugsyConfig | Preset): HugsyConfig {
    const normalized: Partial<HugsyConfig> = {};

    for (const [key, value] of Object.entries(config)) {
      const lowerKey = key.toLowerCase();

      // Map common uppercase variants to lowercase
      switch (lowerKey) {
        case 'env':
          // Merge with existing env if present
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            normalized.env = { ...(normalized.env ?? {}), ...(value as Record<string, string>) };
          }
          break;
        case 'permissions':
          // Also normalize permission sub-fields
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const permValue = value as Record<string, unknown>;
            const normalizedPerms: Record<string, string[] | undefined> = {};
            for (const permKey in permValue) {
              const permLower = permKey.toLowerCase();
              if (permLower === 'allow' || permLower === 'ask' || permLower === 'deny') {
                normalizedPerms[permLower] = permValue[permKey] as string[];
              } else {
                normalizedPerms[permKey] = permValue[permKey] as string[] | undefined;
              }
            }
            normalized.permissions = normalizedPerms;
          }
          break;
        case 'hooks':
          normalized.hooks = value as HookSettings;
          break;
        case 'commands':
          normalized.commands = value as SlashCommandsConfig | string[];
          break;
        case 'extends':
          normalized.extends = value as string | string[];
          break;
        case 'plugins':
          normalized.plugins = value as string[];
          break;
        case 'model':
          normalized.model = value as string;
          break;
        case 'statusline':
          normalized.statusLine = value as StatusLineConfig;
          break;
        case 'includecoauthoredby':
          normalized.includeCoAuthoredBy = value as boolean;
          break;
        case 'cleanupperioddays':
          normalized.cleanupPeriodDays = value as number;
          break;
        case 'apikeyhelper':
          normalized.apiKeyHelper = value as string;
          break;
        default:
          // Keep original key if not a known uppercase variant
          (normalized as Record<string, unknown>)[key] = value;
      }
    }

    return normalized as HugsyConfig;
  }

  /**
   * Resolve conflicts in permissions (deny > ask > allow)
   */
  private resolvePermissionConflicts(permissions: PermissionSettings): void {
    const duplicates: { permission: string; from: string; to: string }[] = [];

    // Remove from allow if in ask
    const allowInAsk = permissions.allow.filter((pattern) => permissions.ask.includes(pattern));
    if (allowInAsk.length > 0) {
      allowInAsk.forEach((p) => duplicates.push({ permission: p, from: 'allow', to: 'ask' }));
    }
    permissions.allow = permissions.allow.filter((pattern) => !permissions.ask.includes(pattern));

    // Remove from allow and ask if in deny
    const allowInDeny = permissions.allow.filter((pattern) => permissions.deny.includes(pattern));
    if (allowInDeny.length > 0) {
      allowInDeny.forEach((p) => duplicates.push({ permission: p, from: 'allow', to: 'deny' }));
    }
    const askInDeny = permissions.ask.filter((pattern) => permissions.deny.includes(pattern));
    if (askInDeny.length > 0) {
      askInDeny.forEach((p) => duplicates.push({ permission: p, from: 'ask', to: 'deny' }));
    }

    permissions.allow = permissions.allow.filter((pattern) => !permissions.deny.includes(pattern));
    permissions.ask = permissions.ask.filter((pattern) => !permissions.deny.includes(pattern));

    // Log deduplication info
    if (duplicates.length > 0 && this.options.verbose) {
      this.log('\n=== Permission Deduplication ===');
      duplicates.forEach(({ permission, from, to }) => {
        this.log(`  ⚠️  Permission "${permission}" found in both '${from}' and '${to}' lists`);
        this.log(`     → Keeping in '${to}' list (higher priority)`);
      });
      this.log('');
    } else if (duplicates.length > 0) {
      // Non-verbose mode: brief message
      console.log(
        `[Info] Resolved ${duplicates.length} permission conflict(s) using security-first priority (deny > ask > allow)`
      );
    }
  }

  /**
   * Load configuration from file
   */
  static async loadConfig(configPath?: string): Promise<HugsyConfig | null> {
    const searchPaths = configPath
      ? [configPath]
      : ['.hugsyrc.json', '.hugsyrc.yml', '.hugsyrc.yaml', 'hugsy.config.js'];

    for (const path of searchPaths) {
      const fullPath = resolve(process.cwd(), path);
      if (existsSync(fullPath)) {
        try {
          const content = readFileSync(fullPath, 'utf-8');

          if (path.endsWith('.json')) {
            return JSON.parse(content) as HugsyConfig;
          } else if (/\.ya?ml$/.exec(path)) {
            try {
              const { parse } = await import('yaml');
              return parse(content) as HugsyConfig;
            } catch (error) {
              console.error('YAML support not available or parsing failed', error);
              return null;
            }
          } else if (path.endsWith('.js')) {
            const module = await import(pathToFileURL(fullPath).href);
            return (module.default ?? module) as HugsyConfig;
          }
        } catch (error) {
          console.error(`Failed to load config from ${path}:`, error);
        }
      }
    }

    return null;
  }
}

// Re-export types from @hugsylabs/hugsy-types for backward compatibility
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
