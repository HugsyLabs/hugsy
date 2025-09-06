/**
 * PackageManager - Handles package detection, loading, and configuration updates
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import type { HugsyConfig } from '@hugsylabs/hugsy-types';

export interface PackageInfo {
  name: string;
  version?: string;
  description?: string;
  type: 'plugin' | 'preset' | 'subagent' | 'command';
  installed: boolean;
}

export type PackageManagerType = 'npm' | 'yarn' | 'pnpm';

export interface InstallResult {
  success: boolean;
  message: string;
  error?: string;
  packageManager?: PackageManagerType;
}

export class PackageManager {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Detect which package manager is being used in the project
   */
  detectPackageManager(): PackageManagerType {
    // Check for lock files
    if (existsSync(join(this.projectRoot, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (existsSync(join(this.projectRoot, 'yarn.lock'))) {
      return 'yarn';
    }
    if (existsSync(join(this.projectRoot, 'package-lock.json'))) {
      return 'npm';
    }
    // Default to npm as it's most universally available
    return 'npm';
  }

  /**
   * Check if we're in a monorepo
   */
  private isMonorepo(): boolean {
    return (
      existsSync(join(this.projectRoot, 'pnpm-workspace.yaml')) ||
      existsSync(join(this.projectRoot, 'lerna.json')) ||
      (existsSync(join(this.projectRoot, 'package.json')) &&
        JSON.parse(readFileSync(join(this.projectRoot, 'package.json'), 'utf-8')).workspaces)
    );
  }

  /**
   * Execute package manager command
   */
  private async executeCommand(
    command: string,
    args: string[]
  ): Promise<{ success: boolean; stdout: string; stderr: string; code: number }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: this.projectRoot,
        env: process.env,
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          stdout,
          stderr: error.message,
          code: -1,
        });
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          stdout,
          stderr,
          code: code ?? 0,
        });
      });
    });
  }

  /**
   * Install npm packages
   */
  async installPackages(packages: string[]): Promise<InstallResult> {
    if (!packages || packages.length === 0) {
      return {
        success: false,
        message: 'No packages specified',
      };
    }

    try {
      const packageManager = this.detectPackageManager();
      const isMonorepo = this.isMonorepo();

      // Build the install command based on package manager
      let args: string[];
      if (packageManager === 'pnpm') {
        args = isMonorepo ? ['add', '-w', ...packages] : ['add', ...packages];
      } else if (packageManager === 'yarn') {
        args = ['add', ...packages];
      } else {
        args = ['install', '--save', ...packages];
      }

      console.log(`Installing packages with ${packageManager}: ${packages.join(', ')}`);
      const result = await this.executeCommand(packageManager, args);

      if (result.success) {
        return {
          success: true,
          message: `Successfully installed ${packages.length} package(s)`,
          packageManager,
        };
      } else {
        // Parse error messages
        let userFriendlyError = 'Failed to install packages';
        const errorMsg = result.stderr || result.stdout;

        if (
          errorMsg.includes('404') ||
          errorMsg.includes('Not Found') ||
          errorMsg.includes('not found')
        ) {
          userFriendlyError = 'Package not found in registry';
        } else if (errorMsg.includes('ENOENT')) {
          userFriendlyError = `Package manager '${packageManager}' not found. Please install it first.`;
        } else if (errorMsg.includes('permission') || errorMsg.includes('EACCES')) {
          userFriendlyError =
            'Permission denied. You may need to run with sudo or fix npm permissions.';
        }

        return {
          success: false,
          message: userFriendlyError,
          error: errorMsg,
          packageManager,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to install packages',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Uninstall npm packages
   */
  async uninstallPackages(packages: string[]): Promise<InstallResult> {
    if (!packages || packages.length === 0) {
      return {
        success: false,
        message: 'No packages specified',
      };
    }

    try {
      const packageManager = this.detectPackageManager();
      const isMonorepo = this.isMonorepo();

      // Build the uninstall command based on package manager
      let args: string[];
      if (packageManager === 'pnpm') {
        args = isMonorepo ? ['remove', '-w', ...packages] : ['remove', ...packages];
      } else if (packageManager === 'yarn') {
        args = ['remove', ...packages];
      } else {
        args = ['uninstall', ...packages];
      }

      console.log(`Uninstalling packages with ${packageManager}: ${packages.join(', ')}`);
      const result = await this.executeCommand(packageManager, args);

      if (result.success) {
        return {
          success: true,
          message: `Successfully uninstalled ${packages.length} package(s)`,
          packageManager,
        };
      } else {
        return {
          success: false,
          message: 'Failed to uninstall packages',
          error: result.stderr || result.stdout,
          packageManager,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to uninstall packages',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Install a package and add it to config
   */
  async installAndAddToConfig(
    packageName: string,
    options?: { plugin?: boolean; preset?: boolean; subagent?: boolean }
  ): Promise<InstallResult> {
    // Skip installation for local files
    if (this.isLocalPackage(packageName)) {
      const type = this.detectPackageType(packageName, options);
      const added = this.addToConfig(packageName, type);
      return {
        success: added,
        message: added
          ? `Added local ${type} to configuration`
          : `${type.charAt(0).toUpperCase() + type.slice(1)} ${packageName} already in configuration`,
      };
    }

    // Install the package
    const installResult = await this.installPackages([packageName]);
    if (!installResult.success) {
      return installResult;
    }

    // Add to config
    const type = this.detectPackageType(packageName, options);
    try {
      const added = this.addToConfig(packageName, type);
      if (!added) {
        return {
          success: false,
          message: `${type.charAt(0).toUpperCase() + type.slice(1)} ${packageName} already in configuration`,
          packageManager: installResult.packageManager,
        };
      }
      return {
        success: true,
        message: `Successfully installed and added ${packageName} as ${type}`,
        packageManager: installResult.packageManager,
      };
    } catch (error) {
      return {
        success: false,
        message: `Package installed but failed to update config: ${error instanceof Error ? error.message : String(error)}`,
        packageManager: installResult.packageManager,
      };
    }
  }

  /**
   * Uninstall a package and remove from config
   */
  async uninstallAndRemoveFromConfig(packageName: string): Promise<InstallResult> {
    // Detect the package type before removing
    const type = this.detectPackageType(packageName);

    // Remove from config first
    let configRemoved = false;
    try {
      configRemoved = this.removeFromConfig(packageName);
    } catch (error) {
      console.error('Failed to remove from config:', error);
    }

    // Skip uninstallation for local files
    if (this.isLocalPackage(packageName)) {
      return {
        success: configRemoved,
        message: configRemoved
          ? `Removed local ${type} from configuration`
          : 'Package not found in configuration',
      };
    }

    // Uninstall the package
    const uninstallResult = await this.uninstallPackages([packageName]);

    if (uninstallResult.success && configRemoved) {
      return {
        success: true,
        message: `Successfully uninstalled ${packageName} and removed from configuration`,
        packageManager: uninstallResult.packageManager,
      };
    } else if (uninstallResult.success && !configRemoved) {
      return {
        success: true,
        message: `Package uninstalled but was not in configuration`,
        packageManager: uninstallResult.packageManager,
      };
    } else {
      return uninstallResult;
    }
  }

  /**
   * Detect if a package name is a plugin or preset
   */
  detectPackageType(
    packageName: string,
    options?: { plugin?: boolean; preset?: boolean; subagent?: boolean }
  ): 'plugin' | 'preset' | 'subagent' {
    // Explicit type from options
    if (options?.plugin) return 'plugin';
    if (options?.preset) return 'preset';
    if (options?.subagent) return 'subagent';

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
    if (lowerName.includes('subagent') || packageName.startsWith('@hugsylabs/subagent-')) {
      return 'subagent';
    }
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
  addToConfig(packageName: string, type: 'plugin' | 'preset' | 'subagent'): boolean {
    const configPath = join(this.projectRoot, '.hugsyrc.json');

    if (!existsSync(configPath)) {
      // Silently return false when config doesn't exist
      // The CLI/UI can decide how to handle this
      return false;
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
      } else if (type === 'subagent') {
        // Initialize subagents array if it doesn't exist or convert from object format
        if (!config.subagents) {
          config.subagents = [];
        } else if (!Array.isArray(config.subagents)) {
          // Convert SubagentsConfig to array format with presets
          const subagentsConfig = config.subagents as { presets?: string[] };
          const presets = subagentsConfig.presets ?? [];
          config.subagents = presets;
        }

        // Check if already exists
        if (Array.isArray(config.subagents) && config.subagents.includes(packageName)) {
          return false; // Already exists
        }

        // Add to subagents array
        if (Array.isArray(config.subagents)) {
          config.subagents.push(packageName);
        }
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
      // Silently return false when config doesn't exist
      // The CLI/UI can decide how to handle this
      return false;
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

      // Try to remove from subagents
      if (config.subagents) {
        if (Array.isArray(config.subagents)) {
          const index = config.subagents.indexOf(packageName);
          if (index > -1) {
            config.subagents.splice(index, 1);
            removed = true;

            // Clean up empty array
            if (config.subagents.length === 0) {
              delete config.subagents;
            }
          }
        } else {
          // Handle SubagentsConfig format
          const subagentsConfig = config.subagents as { presets?: string[] };
          if (subagentsConfig.presets) {
            const presets = subagentsConfig.presets;
            if (Array.isArray(presets)) {
              const index = presets.indexOf(packageName);
              if (index > -1) {
                presets.splice(index, 1);
                removed = true;

                // Clean up if presets becomes empty
                if (presets.length === 0) {
                  delete subagentsConfig.presets;
                  // If SubagentsConfig is now empty, remove it
                  if (Object.keys(config.subagents).length === 0) {
                    delete config.subagents;
                  }
                }
              }
            }
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
