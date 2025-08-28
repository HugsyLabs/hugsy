/**
 * Install command - Set up Hugsy in current project
 */

import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { ProjectConfig } from '../utils/project-config.js';
import { Compiler } from '@hugsylabs/hugsy-compiler';

export function installCommand(): Command {
  const command = new Command('install');

  command
    .description('Compile and install Hugsy configuration to Claude Code')
    .option('-f, --force', 'Overwrite existing configuration')
    .option('-v, --verbose', 'Show detailed compilation process')
    .option('--no-backup', 'Skip backup of existing settings')
    .action(async (options) => {
      logger.section('Installing Hugsy');

      try {
        // 1. Check if .hugsyrc.json exists
        if (!ProjectConfig.exists()) {
          logger.warning('No .hugsyrc.json found. Run "hugsy init" first to create configuration.');
          return;
        }

        // Load and compile configuration
        const hugsyConfig = await ProjectConfig.read();
        if (!hugsyConfig) {
          logger.error('Failed to read .hugsyrc.json');
          return;
        }
        const compiler = new Compiler({
          projectRoot: process.cwd(),
          verbose: options.verbose ?? process.env.HUGSY_DEBUG === 'true',
        });
        const compiledSettings = await compiler.compile(hugsyConfig);

        // 2. Create .claude directory if needed
        const claudeDir = join(process.cwd(), '.claude');
        if (!existsSync(claudeDir)) {
          mkdirSync(claudeDir, { recursive: true });
          logger.success('Created .claude directory');
        }

        // 3. Check for existing settings
        const settingsPath = join(claudeDir, 'settings.json');

        if (existsSync(settingsPath)) {
          if (!options.force) {
            logger.error('Project already has .claude/settings.json');
            logger.info('Use --force to overwrite');
            return;
          }

          // Backup existing settings
          if (options.backup !== false) {
            const backupPath = join(claudeDir, 'settings.json.backup');
            const content = readFileSync(settingsPath, 'utf-8');
            writeFileSync(backupPath, content);
            logger.info(
              `Backed up existing settings to ${chalk.cyan('.claude/settings.json.backup')}`
            );
          }
        }

        // 4. Write compiled settings
        writeFileSync(settingsPath, JSON.stringify(compiledSettings, null, 2));
        logger.success('Updated .claude/settings.json');

        // 5. Handle slash commands
        const commands = compiler.getCompiledCommands();
        if (commands.size > 0) {
          const commandsDir = join(claudeDir, 'commands');

          // Clean existing commands directory if force flag is set
          if (options.force && existsSync(commandsDir)) {
            rmSync(commandsDir, { recursive: true, force: true });
            logger.info('Cleaned existing commands directory');
          }

          // Create commands directory
          if (!existsSync(commandsDir)) {
            mkdirSync(commandsDir, { recursive: true });
            logger.success('Created .claude/commands directory');
          }

          // Write command files
          let commandCount = 0;
          for (const [name, command] of commands) {
            const fileName = `${name}.md`;
            let filePath: string;

            // Handle categories (subdirectories)
            if (command.category) {
              const categoryDir = join(commandsDir, command.category);
              if (!existsSync(categoryDir)) {
                mkdirSync(categoryDir, { recursive: true });
              }
              filePath = join(categoryDir, fileName);
            } else {
              filePath = join(commandsDir, fileName);
            }

            // Build command content with optional frontmatter
            let content = '';

            // Add frontmatter if there are metadata fields
            const hasFrontmatter =
              command.description !== undefined ||
              command.argumentHint !== undefined ||
              command.model !== undefined ||
              command.allowedTools !== undefined;

            if (options.verbose) {
              logger.info(
                `Command '${name}': hasFrontmatter=${hasFrontmatter}, argumentHint='${command.argumentHint}'`
              );
            }

            if (hasFrontmatter) {
              content += '---\n';
              if (command.description) content += `description: ${command.description}\n`;
              if (command.argumentHint) content += `argument-hint: ${command.argumentHint}\n`;
              if (command.model) content += `model: ${command.model}\n`;
              if (command.allowedTools && command.allowedTools.length > 0) {
                content += `allowed-tools: ${command.allowedTools.join(', ')}\n`;
              }
              content += '---\n\n';
            }

            content += command.content;

            writeFileSync(filePath, content);
            commandCount++;

            if (options.verbose) {
              const relativePath = command.category ? `${command.category}/${name}` : name;
              logger.info(`  Created command: /${name} → commands/${relativePath}.md`);
            }
          }

          logger.success(`Generated ${commandCount} slash command${commandCount > 1 ? 's' : ''}`);
        }

        // 6. Show summary
        logger.divider();
        logger.success('Hugsy installed successfully!');
        logger.section('Next steps');
        logger.item('Your Claude Code configuration is now active');
        logger.item('Edit .hugsyrc.json to customize permissions');
        logger.item('Run "hugsy status" to verify installation');

        logger.section('Important');
        logger.item(
          '.claude/settings.json',
          'Compiled Claude Code settings from your .hugsyrc.json'
        );
        logger.warning('Make sure to commit .claude/settings.json to version control');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Installation failed: ${errorMessage}`);
        if (process.env.HUGSY_DEBUG) {
          console.error(error);
        }
      }
    });

  return command;
}
