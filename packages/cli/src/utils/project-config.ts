/**
 * Project .hugsyrc.json utilities
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { HugsyConfig } from '@hugsylabs/hugsy-types';
import { logger } from './logger.js';

const CONFIG_NAMES = ['.hugsyrc.json', '.hugsyrc.yml', '.hugsyrc.yaml', 'hugsy.config.js'];

export class ProjectConfig {
  /**
   * Find config file in current directory
   */
  static find(dir: string = process.cwd()): string | null {
    for (const name of CONFIG_NAMES) {
      const path = join(dir, name);
      if (existsSync(path)) {
        return path;
      }
    }

    // Check package.json
    const packagePath = join(dir, 'package.json');
    if (existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
        if (pkg.hugsy) {
          return packagePath;
        }
      } catch {
        // Ignore error - file doesn't exist or invalid JSON
      }
    }

    return null;
  }

  /**
   * Check if project has config
   */
  static exists(dir?: string): boolean {
    return this.find(dir) !== null;
  }

  /**
   * Read project config
   */
  static async read(dir?: string): Promise<HugsyConfig | null> {
    const configPath = this.find(dir);
    if (!configPath) {
      return null;
    }

    try {
      const content = readFileSync(configPath, 'utf-8');

      // Handle package.json
      if (configPath.endsWith('package.json')) {
        const pkg = JSON.parse(content);
        return pkg.hugsy as HugsyConfig;
      }

      // Handle JSON
      if (configPath.endsWith('.json')) {
        const parsed = JSON.parse(content);
        // Validate that root is an object, not an array
        if (Array.isArray(parsed)) {
          logger.error('Configuration file must be an object, not an array');
          throw new Error('Invalid configuration: root must be an object, not an array');
        }
        return parsed as HugsyConfig;
      }

      // Handle YAML (if yaml package is available)
      if (/\.ya?ml$/.test(configPath)) {
        try {
          const yaml = await import('yaml');
          return yaml.parse(content) as HugsyConfig;
        } catch {
          logger.error('YAML parser not available');
          return null;
        }
      }

      // Handle JS
      if (configPath.endsWith('.js')) {
        const config = await import(configPath);
        return (config.default ?? config) as HugsyConfig;
      }

      return null;
    } catch (error) {
      logger.error(`Failed to read config: ${String(error)}`);
      return null;
    }
  }

  /**
   * Write project config
   */
  static write(config: HugsyConfig, dir: string = process.cwd()): boolean {
    try {
      const configPath = join(dir, '.hugsyrc.json');
      const content = JSON.stringify(config, null, 2);
      writeFileSync(configPath, content);
      return true;
    } catch (error) {
      logger.error(`Failed to write config: ${String(error)}`);
      return false;
    }
  }
}
