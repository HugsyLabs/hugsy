/**
 * Package manager utilities for installing and managing Hugsy plugins/presets
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';

/**
 * Detect which package manager is being used in the project
 */
export function detectPackageManager(): 'npm' | 'yarn' | 'pnpm' {
  const cwd = process.cwd();
  
  // Check for lock files
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (existsSync(join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }
  // Default to npm
  return 'npm';
}

/**
 * Detect if a package name is a plugin or preset
 */
export function detectPackageType(packageName: string, options?: { plugin?: boolean; preset?: boolean }): 'plugin' | 'preset' {
  // Explicit type from options
  if (options?.plugin) return 'plugin';
  if (options?.preset) return 'preset';
  
  // Check if it's a local file
  if (packageName.startsWith('./') || packageName.startsWith('../') || packageName.startsWith('/')) {
    // Local files: check extension
    if (packageName.endsWith('.json')) return 'preset';
    if (packageName.endsWith('.js') || packageName.endsWith('.mjs') || packageName.endsWith('.ts')) return 'plugin';
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
 * Install npm package using detected package manager
 */
export function installNpmPackage(packageName: string): boolean {
  // Skip if it's a local file
  if (packageName.startsWith('./') || packageName.startsWith('../') || packageName.startsWith('/')) {
    return true;
  }
  
  const pm = detectPackageManager();
  const cwd = process.cwd();
  let installCmd = {
    npm: 'npm install --save-dev',
    yarn: 'yarn add --dev',
    pnpm: 'pnpm add -D'
  }[pm];
  
  // Check if we're in a pnpm workspace and adjust command accordingly
  if (pm === 'pnpm' && existsSync(join(cwd, 'pnpm-workspace.yaml'))) {
    installCmd = 'pnpm add -wD'; // Add -w flag for workspace root
    logger.info('Detected pnpm workspace, using -w flag');
  }
  
  try {
    logger.info(`📦 Installing ${packageName} using ${pm}...`);
    execSync(`${installCmd} ${packageName}`, {
      stdio: 'inherit',
      cwd: cwd
    });
    logger.success(`Package installed: ${packageName}`);
    return true;
  } catch (error) {
    logger.error(`Failed to install package: ${packageName}`);
    if (error instanceof Error) {
      logger.error(error.message);
    }
    return false;
  }
}

/**
 * Update .hugsyrc.json with new package
 */
export function updateHugsyConfig(packageName: string, type: 'plugin' | 'preset'): boolean {
  const configPath = join(process.cwd(), '.hugsyrc.json');
  
  if (!existsSync(configPath)) {
    logger.error('No .hugsyrc.json found. Run "hugsy init" first.');
    return false;
  }
  
  try {
    const configContent = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    if (type === 'plugin') {
      // Initialize plugins array if it doesn't exist
      config.plugins ??= [];
      
      // Check if already exists
      if (config.plugins.includes(packageName)) {
        logger.warning(`Plugin ${packageName} already in configuration`);
        return true;
      }
      
      // Add to plugins array
      config.plugins.push(packageName);
      logger.success(`Added plugin to configuration: ${packageName}`);
      
    } else {
      // Handle presets (extends field)
      config.extends ??= [];
      
      // Normalize to array
      if (typeof config.extends === 'string') {
        config.extends = [config.extends];
      }
      
      // Check if already exists
      if (config.extends.includes(packageName)) {
        logger.warning(`Preset ${packageName} already in configuration`);
        return true;
      }
      
      // Add to extends array
      config.extends.push(packageName);
      logger.success(`Added preset to configuration: ${packageName}`);
    }
    
    // Write back to file
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
    
  } catch (error) {
    logger.error(`Failed to update .hugsyrc.json: ${String(error)}`);
    return false;
  }
}

/**
 * Remove package from .hugsyrc.json
 */
export function removeFromHugsyConfig(packageName: string): boolean {
  const configPath = join(process.cwd(), '.hugsyrc.json');
  
  if (!existsSync(configPath)) {
    logger.error('No .hugsyrc.json found.');
    return false;
  }
  
  try {
    const configContent = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);
    let removed = false;
    
    // Try to remove from plugins
    if (config.plugins && Array.isArray(config.plugins)) {
      const index = config.plugins.indexOf(packageName);
      if (index > -1) {
        config.plugins.splice(index, 1);
        logger.success(`Removed plugin from configuration: ${packageName}`);
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
          logger.success(`Removed preset from configuration: ${packageName}`);
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
        logger.success(`Removed preset from configuration: ${packageName}`);
        removed = true;
      }
    }
    
    if (!removed) {
      logger.warning(`Package ${packageName} not found in configuration`);
      return false;
    }
    
    // Write back to file
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
    
  } catch (error) {
    logger.error(`Failed to update .hugsyrc.json: ${String(error)}`);
    return false;
  }
}