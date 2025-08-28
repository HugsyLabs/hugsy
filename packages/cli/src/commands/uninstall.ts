/**
 * Uninstall command - Remove Hugsy from current project
 */

import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import prompts from 'prompts';
import { logger } from '../utils/logger.js';

export function uninstallCommand(): Command {
  const command = new Command('uninstall');

  command
    .description('Remove Hugsy configuration from current project')
    .option('--keep-config', 'Keep .hugsyrc.json file')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (options) => {
      logger.section('Uninstalling Hugsy');

      try {
        // Check if Hugsy is installed
        const claudeSettingsPath = join(process.cwd(), '.claude', 'settings.json');
        const configPath = join(process.cwd(), '.hugsyrc.json');

        let hasHugsy = false;

        if (existsSync(claudeSettingsPath)) {
          const settings = JSON.parse(readFileSync(claudeSettingsPath, 'utf-8'));
          if (settings.hooks) {
            for (const hookType of Object.keys(settings.hooks)) {
              const entries = settings.hooks[hookType];
              if (Array.isArray(entries)) {
                for (const entry of entries) {
                  if (
                    entry.hooks?.some((h: { command?: string }) =>
                      h.command?.toLowerCase().includes('hugsy')
                    )
                  ) {
                    hasHugsy = true;
                    break;
                  }
                }
              }
            }
          }
        }

        if (!hasHugsy && !existsSync(configPath)) {
          logger.warning('Hugsy is not installed in this project');
          return;
        }

        // Confirm uninstall
        if (!options.yes) {
          const response = await prompts({
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to uninstall Hugsy from this project?',
            initial: false,
          });

          if (!response.confirm) {
            logger.warning('Uninstall cancelled');
            return;
          }
        }

        let removed = [];

        // 1. Remove hooks from .claude/settings.json
        if (existsSync(claudeSettingsPath)) {
          const settings = JSON.parse(readFileSync(claudeSettingsPath, 'utf-8'));
          let modified = false;

          if (settings.hooks) {
            for (const hookType of Object.keys(settings.hooks)) {
              const entries = settings.hooks[hookType];
              if (Array.isArray(entries)) {
                for (const entry of entries) {
                  if (entry.hooks) {
                    const originalLength = entry.hooks.length;
                    entry.hooks = entry.hooks.filter(
                      (h: { command?: string }) => !h.command?.toLowerCase().includes('hugsy')
                    );
                    if (entry.hooks.length < originalLength) {
                      modified = true;
                    }
                  }
                }
                // Remove empty entries
                settings.hooks[hookType] = entries.filter(
                  (e: { hooks?: unknown[] }) => e.hooks && e.hooks.length > 0
                );
              }
            }
          }

          if (modified) {
            writeFileSync(claudeSettingsPath, JSON.stringify(settings, null, 2));
            removed.push('.claude/settings.json hooks');
            logger.success('Removed Hugsy hooks from .claude/settings.json');
          }
        }

        // 2. Remove .hugsyrc.json
        if (!options.keepConfig && existsSync(configPath)) {
          // Skip prompt if --yes flag is used
          if (options.yes) {
            rmSync(configPath, { force: true });
            removed.push('.hugsyrc.json');
            logger.success('Removed .hugsyrc.json');
          } else {
            const response = await prompts({
              type: 'confirm',
              name: 'removeConfig',
              message: 'Remove .hugsyrc.json configuration file?',
              initial: false,
            });

            if (response.removeConfig) {
              rmSync(configPath, { force: true });
              removed.push('.hugsyrc.json');
              logger.success('Removed .hugsyrc.json');
            } else {
              logger.info('Kept .hugsyrc.json');
            }
          }
        } else if (options.keepConfig && existsSync(configPath)) {
          logger.info('Kept .hugsyrc.json');
        }

        // Summary
        logger.divider();
        if (removed.length > 0) {
          logger.success('Hugsy uninstalled successfully!');
          logger.section('Removed');
          for (const item of removed) {
            logger.item(item);
          }
        } else {
          logger.warning('Nothing to uninstall');
        }

        if (options.keepConfig) {
          logger.section('Kept');
          logger.item('.hugsyrc.json configuration');
          logger.info('Run "hugsy install" to re-enable');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Uninstall failed: ${errorMessage}`);
        if (process.env.HUGSY_DEBUG) {
          console.error(error);
        }
      }
    });

  return command;
}
