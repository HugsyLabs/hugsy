/**
 * Status command - Show Hugsy installation and configuration status
 */

import { Command } from 'commander';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { ProjectConfig } from '../utils/project-config.js';
import type { HugsyConfig } from '@hugsylabs/hugsy-types';

export function statusCommand(): Command {
  const command = new Command('status');

  command
    .description('Show Hugsy installation and configuration status')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options) => {
      logger.section('Hugsy Status');

      try {
        const status = {
          projectConfig: false,
          claudeSettings: false,
          pluginCount: 0,
          permissionCount: 0,
          configChanged: false,
          partialInstallation: false,
        };

        // 1. Check .hugsyrc.json
        const configPath = ProjectConfig.find();
        if (configPath) {
          status.projectConfig = true;
          const config = await ProjectConfig.read();

          if (config) {
            // Count plugins
            status.pluginCount = config.plugins?.length ?? 0;

            // Count permissions
            if (config.permissions) {
              status.permissionCount =
                (config.permissions.allow?.length ?? 0) +
                (config.permissions.ask?.length ?? 0) +
                (config.permissions.deny?.length ?? 0);
            }
          }
        }

        // 2. Check .claude/settings.json
        const claudeDir = join(process.cwd(), '.claude');
        const claudeSettingsPath = join(claudeDir, 'settings.json');
        
        // Check if settings.json actually exists (not just the directory)
        if (existsSync(claudeSettingsPath)) {
          status.claudeSettings = true;
          
          // Check if configuration has changed since installation
          if (status.projectConfig && configPath) {
            const configStat = statSync(configPath);
            const settingsStat = statSync(claudeSettingsPath);
            
            // If config is newer than settings, it has changed
            if (configStat.mtime > settingsStat.mtime) {
              status.configChanged = true;
            }
          }
        } else if (existsSync(claudeDir)) {
          // Directory exists but no settings.json - partial installation
          status.partialInstallation = true;
        }

        // Display status
        logger.section('Configuration');

        // Project config
        if (status.projectConfig) {
          logger.success(`.hugsyrc.json found at ${relative(configPath!)}`);
          if (options.verbose) {
            const config = await ProjectConfig.read();
            if (config) {
              if (config.extends) {
                const extendsList = Array.isArray(config.extends)
                  ? config.extends
                  : [config.extends];
                logger.item('Extends', extendsList.join(', '));
              }
              logger.item('Plugins', status.pluginCount.toString());
              logger.item('Permission rules', status.permissionCount.toString());
            }
          }
        } else {
          logger.error('.hugsyrc.json not found');
          logger.info('Run "hugsy init" to create configuration');
        }

        logger.section('Installation');

        // Claude settings
        if (status.claudeSettings) {
          logger.success('.claude/settings.json exists');
          const settings = JSON.parse(readFileSync(claudeSettingsPath, 'utf-8'));
          if (options.verbose && settings.permissions) {
            logger.item('Allow rules', (settings.permissions.allow?.length ?? 0).toString());
            logger.item('Ask rules', (settings.permissions.ask?.length ?? 0).toString());
            logger.item('Deny rules', (settings.permissions.deny?.length ?? 0).toString());
          }
        } else {
          logger.error('.claude/settings.json not found');
          logger.info('Run "hugsy install" to create it');
        }

        // Overall status
        logger.divider();
        const isFullyInstalled = status.projectConfig && status.claudeSettings;

        if (isFullyInstalled) {
          if (status.configChanged) {
            logger.box(`⚠️  Configuration has changed since installation!
Run "hugsy install" to update`);
          } else {
            logger.box(`✅ Hugsy is fully installed and configured!`);
          }
        } else if (status.partialInstallation) {
          logger.box(`❌ Partial installation detected!
.claude directory exists but settings.json is missing
Run "hugsy install --force" to fix`);
        } else if (status.projectConfig) {
          logger.box(`⚠️  Configuration exists but not installed
Run "hugsy install" to activate`);
        } else {
          logger.box(`❌ Hugsy is not installed
1. Run "hugsy init" to create configuration
2. Run "hugsy install" to activate`);
        }

        // Verbose mode - show additional details
        if (options.verbose && status.projectConfig) {
          const config = await ProjectConfig.read();
          if (config) {
            if (config.permissions) {
              logger.section('Permissions Detail');
              displayPermissionsDetail(config);
            }

            if (config.plugins && config.plugins.length > 0) {
              logger.section('Plugins');
              for (const plugin of config.plugins) {
                logger.item(plugin);
              }
            }

            if (config.env && Object.keys(config.env).length > 0) {
              logger.section('Environment Variables');
              for (const [key, value] of Object.entries(config.env)) {
                logger.item(`${key}=${value}`);
              }
            }
          }
        }

        // Check for common issues
        if (status.projectConfig && !status.claudeSettings) {
          logger.section('💡 Quick Fix');
          logger.info('Run: ' + chalk.cyan('hugsy install'));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Status check failed: ${errorMessage}`);
        if (process.env.HUGSY_DEBUG) {
          console.error(error);
        }
      }
    });

  return command;
}

/**
 * Get relative path from current directory
 */
function relative(filePath: string): string {
  const rel = filePath.replace(process.cwd(), '').replace(/^\//, '');
  return rel ?? '.';
}

/**
 * Display detailed permissions information
 */
function displayPermissionsDetail(config: HugsyConfig): void {
  if (!config.permissions) return;

  if (config.permissions.deny && config.permissions.deny.length > 0) {
    console.log(chalk.red('  Deny:'));
    for (const rule of config.permissions.deny) {
      console.log(`    🚫 ${rule}`);
    }
  }

  if (config.permissions.ask && config.permissions.ask.length > 0) {
    console.log(chalk.yellow('  Ask:'));
    for (const rule of config.permissions.ask) {
      console.log(`    ⚠️  ${rule}`);
    }
  }

  if (config.permissions.allow && config.permissions.allow.length > 0) {
    console.log(chalk.green('  Allow:'));
    for (const rule of config.permissions.allow.slice(0, 5)) {
      console.log(`    ✅ ${rule}`);
    }
    if (config.permissions.allow.length > 5) {
      console.log(`    ... and ${config.permissions.allow.length - 5} more`);
    }
  }
}
