/**
 * ConfigManager - Handles reading, writing, and validating Hugsy configuration files
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { HugsyConfig } from '@hugsylabs/hugsy-types';

export interface ConfigOptions {
  projectRoot?: string;
  configPath?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConfigManager {
  private projectRoot: string;
  private configPath: string;

  constructor(options: ConfigOptions = {}) {
    this.projectRoot = options.projectRoot ?? process.cwd();
    this.configPath = options.configPath ?? this.findConfigPath();
  }

  /**
   * Find .hugsyrc.json in project
   */
  private findConfigPath(): string {
    const possiblePaths = [
      '.hugsyrc.json',
      '.hugsyrc.yml',
      '.hugsyrc.yaml',
      'hugsy.config.js',
      'hugsy.config.json',
    ];

    for (const path of possiblePaths) {
      const fullPath = join(this.projectRoot, path);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }

    // Default to .hugsyrc.json
    return join(this.projectRoot, '.hugsyrc.json');
  }

  /**
   * Check if configuration exists
   */
  exists(): boolean {
    return existsSync(this.configPath);
  }

  /**
   * Read configuration from file
   */
  read(): HugsyConfig | null {
    if (!this.exists()) {
      return null;
    }

    try {
      const content = readFileSync(this.configPath, 'utf-8');

      // Handle JSON
      if (this.configPath.endsWith('.json')) {
        return JSON.parse(content) as HugsyConfig;
      }

      // Handle YAML (would need yaml package)
      if (this.configPath.endsWith('.yml') || this.configPath.endsWith('.yaml')) {
        // Note: Would need to import yaml package for this
        throw new Error('YAML config files require yaml package to be installed');
      }

      // Handle JS config files
      if (this.configPath.endsWith('.js')) {
        throw new Error('JS config files cannot be read synchronously. Use loadConfig() instead.');
      }

      return JSON.parse(content) as HugsyConfig;
    } catch (error) {
      throw new Error(
        `Failed to read config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Write configuration to file
   */
  write(config: HugsyConfig, path?: string): void {
    const targetPath = path ?? this.configPath;

    try {
      const content = JSON.stringify(config, null, 2);
      writeFileSync(targetPath, content, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to write config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create default configuration
   */
  createDefault(options?: { preset?: string }): HugsyConfig {
    const preset = options?.preset ?? 'recommended';

    const configs: Record<string, HugsyConfig> = {
      recommended: {
        extends: '@hugsylabs/hugsy-core/presets/recommended',
        env: {
          NODE_ENV: 'development',
        },
      },
      minimal: {
        permissions: {
          allow: ['Read(**)', 'Write(**)', 'Bash(*)'],
        },
      },
      strict: {
        extends: '@hugsylabs/hugsy-core/presets/strict',
        permissions: {
          deny: ['Write(*:*password=*)', 'Write(*:*secret=*)', 'Read(**/.env*)', 'Bash(sudo *)'],
          ask: ['Bash(*)', 'Write(**)', 'WebSearch(*)'],
        },
        env: {
          NODE_ENV: 'production',
          STRICT_MODE: 'true',
        },
      },
      // Alias for strict
      security: {
        extends: '@hugsylabs/hugsy-core/presets/strict',
        permissions: {
          deny: [
            'Write(*:*password=*)',
            'Write(*:*secret=*)',
            'Write(*:*api_key=*)',
            'Write(*:*token=*)',
            'Read(**/.env*)',
            'Read(**/secrets/**)',
            'Bash(curl *)',
            'Bash(wget *)',
            'WebSearch(*)',
          ],
          ask: ['Bash(sudo *)', 'Bash(npm *)', 'Bash(pip *)', 'Write(**)'],
        },
        env: {
          NODE_ENV: 'production',
          STRICT_MODE: 'true',
        },
      },
      permissive: {
        extends: '@hugsylabs/hugsy-core/presets/development',
        permissions: {
          deny: [
            'Bash(rm -rf /*)',
            'Bash(:(){ :|:& };:)', // Fork bomb
          ],
          allow: ['Read(**)', 'Write(**)', 'Bash(*)'],
        },
      },
      development: {
        extends: '@hugsylabs/hugsy-core/presets/development',
        permissions: {
          allow: ['Read(**)', 'Write(**)', 'Bash(*)'],
        },
        env: {
          NODE_ENV: 'development',
        },
      },
      // Basic template for custom configurations
      custom: {
        env: {
          NODE_ENV: 'development',
        },
      },
    };

    return configs[preset] ?? configs.recommended;
  }

  /**
   * Validate configuration
   */
  validate(config: HugsyConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required fields
    if (!config || typeof config !== 'object') {
      errors.push('Configuration must be an object');
      return { valid: false, errors, warnings };
    }

    // Validate extends field
    if (config.extends !== undefined) {
      if (typeof config.extends !== 'string' && !Array.isArray(config.extends)) {
        errors.push('extends field must be a string or array of strings');
      } else if (Array.isArray(config.extends)) {
        for (const item of config.extends) {
          if (typeof item !== 'string') {
            errors.push('extends array must contain only strings');
            break;
          }
        }
      }
    }

    // Validate plugins field
    if (config.plugins !== undefined) {
      if (!Array.isArray(config.plugins)) {
        errors.push('plugins field must be an array');
      } else {
        for (const plugin of config.plugins) {
          if (typeof plugin !== 'string') {
            errors.push('plugins array must contain only strings');
            break;
          }
        }
      }
    }

    // Validate permissions
    if (config.permissions !== undefined) {
      if (typeof config.permissions !== 'object' || config.permissions === null) {
        errors.push('permissions field must be an object');
      } else {
        const validPermissionKeys = ['allow', 'ask', 'deny'];
        for (const key of Object.keys(config.permissions)) {
          if (!validPermissionKeys.includes(key)) {
            warnings.push(`Unknown permissions key: ${key}`);
          }
          const value = config.permissions[key as keyof typeof config.permissions];
          if (value !== undefined && !Array.isArray(value)) {
            errors.push(`permissions.${key} must be an array`);
          } else if (Array.isArray(value)) {
            for (const item of value) {
              if (typeof item !== 'string') {
                errors.push(`permissions.${key} must contain only strings`);
                break;
              }
            }
          }
        }
      }
    }

    // Validate env
    if (config.env !== undefined) {
      if (typeof config.env !== 'object' || config.env === null) {
        errors.push('env field must be an object');
      } else {
        for (const [key, value] of Object.entries(config.env)) {
          if (typeof value !== 'string') {
            errors.push(`env.${key} must be a string`);
          }
        }
      }
    }

    // Validate statusLine
    if (config.statusLine !== undefined) {
      if (typeof config.statusLine !== 'object' || config.statusLine === null) {
        errors.push('statusLine field must be an object');
      } else {
        if (config.statusLine.type && !['command', 'static'].includes(config.statusLine.type)) {
          errors.push('statusLine.type must be "command" or "static"');
        }
      }
    }

    // Validate model
    if (config.model !== undefined && typeof config.model !== 'string') {
      errors.push('model field must be a string');
    }

    // Validate cleanupPeriodDays
    if (config.cleanupPeriodDays !== undefined && typeof config.cleanupPeriodDays !== 'number') {
      errors.push('cleanupPeriodDays field must be a number');
    }

    // Validate includeCoAuthoredBy
    if (
      config.includeCoAuthoredBy !== undefined &&
      typeof config.includeCoAuthoredBy !== 'boolean'
    ) {
      errors.push('includeCoAuthoredBy field must be a boolean');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Merge configurations (base + override)
   */
  merge(base: HugsyConfig, override: HugsyConfig): HugsyConfig {
    const merged: HugsyConfig = { ...base };

    // Merge extends
    if (override.extends !== undefined) {
      if (base.extends !== undefined) {
        const baseExtends = Array.isArray(base.extends) ? base.extends : [base.extends];
        const overrideExtends = Array.isArray(override.extends)
          ? override.extends
          : [override.extends];
        merged.extends = [...new Set([...baseExtends, ...overrideExtends])];
        if (merged.extends.length === 1) {
          merged.extends = merged.extends[0];
        }
      } else {
        merged.extends = override.extends;
      }
    }

    // Merge plugins
    if (override.plugins !== undefined) {
      merged.plugins = [...new Set([...(base.plugins ?? []), ...override.plugins])];
    }

    // Merge permissions
    if (override.permissions !== undefined) {
      merged.permissions = {
        allow: [
          ...new Set([...(base.permissions?.allow ?? []), ...(override.permissions.allow ?? [])]),
        ],
        ask: [...new Set([...(base.permissions?.ask ?? []), ...(override.permissions.ask ?? [])])],
        deny: [
          ...new Set([...(base.permissions?.deny ?? []), ...(override.permissions.deny ?? [])]),
        ],
      };
    }

    // Merge env
    if (override.env !== undefined) {
      merged.env = {
        ...(base.env ?? {}),
        ...override.env,
      };
    }

    // Override simple fields
    if (override.statusLine !== undefined) merged.statusLine = override.statusLine;
    if (override.model !== undefined) merged.model = override.model;
    if (override.cleanupPeriodDays !== undefined) {
      merged.cleanupPeriodDays = override.cleanupPeriodDays;
    }
    if (override.includeCoAuthoredBy !== undefined) {
      merged.includeCoAuthoredBy = override.includeCoAuthoredBy;
    }

    return merged;
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Get project root
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * Initialize new configuration
   */
  init(options?: { force?: boolean; preset?: string }): boolean {
    if (this.exists() && !options?.force) {
      return false;
    }

    const config = this.createDefault({ preset: options?.preset });
    this.write(config);
    return true;
  }

  /**
   * Get available presets
   */
  static getAvailablePresets(): { name: string; description: string }[] {
    return [
      {
        name: 'recommended',
        description: 'Best practices for secure and reliable code generation',
      },
      {
        name: 'security',
        description: 'Strict security controls to prevent sensitive data exposure',
      },
      {
        name: 'permissive',
        description: 'Allow most actions, only block dangerous operations',
      },
      {
        name: 'development',
        description: 'Development-friendly settings with minimal restrictions',
      },
      {
        name: 'minimal',
        description: 'Minimal configuration with basic permissions',
      },
      {
        name: 'strict',
        description: 'Strict controls with ask permissions for most operations',
      },
      {
        name: 'custom',
        description: 'Basic template for custom configuration',
      },
    ];
  }
}
