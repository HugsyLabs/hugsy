/**
 * PackageManager - Handles package detection, loading, and configuration updates
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { HugsyConfig } from '@hugsylabs/hugsy-types';

export interface PackageInfo {
  name: string;
  version?: string;
  description?: string;
  type: 'plugin' | 'preset';
  installed: boolean;
}

export class PackageManager {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Detect if a package name is a plugin or preset
   */
  detectPackageType(
    packageName: string,
    options?: { plugin?: boolean; preset?: boolean }
  ): 'plugin' | 'preset' {
    // Explicit type from options
    if (options?.plugin) return 'plugin';
    if (options?.preset) return 'preset';

    // Check if it's a local file
    if (
      packageName.startsWith('./') ||
      packageName.startsWith('../') ||
      packageName.startsWith('/')
    ) {
      // Local files: check extension
      if (packageName.endsWith('.json')) return 'preset';
      if (
        packageName.endsWith('.js') ||
        packageName.endsWith('.mjs') ||
        packageName.endsWith('.ts')
      ) {
        return 'plugin';
      }
    }

    // NPM packages: check naming convention
    const lowerName = packageName.toLowerCase();
    if (lowerName.includes('preset') || lowerName.includes('config')) {
      return 'preset';
    }
    if (lowerName.includes('plugin')) {
      return 'plugin';
    }

    // Default to plugin
    return 'plugin';
  }

  /**
   * Update .hugsyrc.json with new package
   */
  addToConfig(packageName: string, type: 'plugin' | 'preset'): boolean {
    const configPath = join(this.projectRoot, '.hugsyrc.json');

    if (!existsSync(configPath)) {
      throw new Error('No .hugsyrc.json found. Run "hugsy init" first.');
    }

    try {
      const configContent = readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent) as HugsyConfig;

      if (type === 'plugin') {
        // Initialize plugins array if it doesn't exist
        config.plugins ??= [];

        // Check if already exists
        if (config.plugins.includes(packageName)) {
          return false; // Already exists
        }

        // Add to plugins array
        config.plugins.push(packageName);
      } else {
        // Handle presets (extends field)
        config.extends ??= [];

        // Normalize to array
        if (typeof config.extends === 'string') {
          config.extends = [config.extends];
        }

        // Check if already exists
        if (Array.isArray(config.extends) && config.extends.includes(packageName)) {
          return false; // Already exists
        }

        // Add to extends array
        if (Array.isArray(config.extends)) {
          config.extends.push(packageName);
        }
      }

      // Write back to file
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      throw new Error(
        `Failed to update .hugsyrc.json: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Remove package from .hugsyrc.json
   */
  removeFromConfig(packageName: string): boolean {
    const configPath = join(this.projectRoot, '.hugsyrc.json');

    if (!existsSync(configPath)) {
      throw new Error('No .hugsyrc.json found.');
    }

    try {
      const configContent = readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent) as HugsyConfig;
      let removed = false;

      // Try to remove from plugins
      if (config.plugins && Array.isArray(config.plugins)) {
        const index = config.plugins.indexOf(packageName);
        if (index > -1) {
          config.plugins.splice(index, 1);
          removed = true;

          // Clean up empty array
          if (config.plugins.length === 0) {
            delete config.plugins;
          }
        }
      }

      // Try to remove from extends
      if (config.extends) {
        if (Array.isArray(config.extends)) {
          const index = config.extends.indexOf(packageName);
          if (index > -1) {
            config.extends.splice(index, 1);
            removed = true;

            // Clean up empty array
            if (config.extends.length === 0) {
              delete config.extends;
            } else if (config.extends.length === 1) {
              // Convert back to string if only one item
              config.extends = config.extends[0];
            }
          }
        } else if (config.extends === packageName) {
          delete config.extends;
          removed = true;
        }
      }

      if (!removed) {
        return false; // Package not found in configuration
      }

      // Write back to file
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      throw new Error(
        `Failed to update .hugsyrc.json: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get package info from node_modules
   */
  getPackageInfo(packageName: string): PackageInfo | null {
    try {
      const packageJsonPath = join(this.projectRoot, 'node_modules', packageName, 'package.json');

      if (!existsSync(packageJsonPath)) {
        return {
          name: packageName,
          type: this.detectPackageType(packageName),
          installed: false,
        };
      }

      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      return {
        name: packageName,
        version: packageJson.version,
        description: packageJson.description,
        type: this.detectPackageType(packageName),
        installed: true,
      };
    } catch {
      return null;
    }
  }

  /**
   * Discover available packages in node_modules
   */
  discoverPackages(): PackageInfo[] {
    const packages: PackageInfo[] = [];
    const nodeModulesPath = join(this.projectRoot, 'node_modules');

    if (!existsSync(nodeModulesPath)) {
      return packages;
    }

    try {
      // Look for known Hugsy packages
      const knownPrefixes = ['@hugsylabs/', '@hugsy/', 'hugsy-'];

      // Read package.json to find dependencies that might be Hugsy packages
      const projectPackageJsonPath = join(this.projectRoot, 'package.json');
      if (existsSync(projectPackageJsonPath)) {
        const projectPackageJson = JSON.parse(readFileSync(projectPackageJsonPath, 'utf-8'));
        const deps = {
          ...projectPackageJson.dependencies,
          ...projectPackageJson.devDependencies,
        };

        for (const [name] of Object.entries(deps)) {
          // Check if it's a potential Hugsy package
          const isHugsyPackage =
            knownPrefixes.some((prefix) => name.startsWith(prefix)) || name.includes('hugsy');

          if (isHugsyPackage) {
            const info = this.getPackageInfo(name);
            if (info) {
              packages.push(info);
            }
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return packages;
  }

  /**
   * Check if package is local file or npm package
   */
  isLocalPackage(packageName: string): boolean {
    return (
      packageName.startsWith('./') || packageName.startsWith('../') || packageName.startsWith('/')
    );
  }

  /**
   * Validate package can be loaded
   */
  validatePackage(packageName: string): { valid: boolean; error?: string } {
    if (this.isLocalPackage(packageName)) {
      const fullPath = join(this.projectRoot, packageName);
      if (!existsSync(fullPath)) {
        return { valid: false, error: `Local file not found: ${fullPath}` };
      }
      return { valid: true };
    } else {
      const packageJsonPath = join(this.projectRoot, 'node_modules', packageName, 'package.json');
      if (!existsSync(packageJsonPath)) {
        return { valid: false, error: `Package not installed: ${packageName}` };
      }
      return { valid: true };
    }
  }
}
