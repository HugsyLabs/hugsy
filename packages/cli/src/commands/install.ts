/**
 * Install command - Set up Hugsy in current project
 */

import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import prompts from 'prompts';
import { logger } from '../utils/logger.js';
import { ProjectConfig } from '../utils/project-config.js';
import { Compiler } from '@hugsylabs/hugsy-compiler';
import {
  detectPackageType,
  installNpmPackage,
  updateHugsyConfig,
} from '../utils/package-manager.js';

export function installCommand(): Command {
  const command = new Command('install');

  command
    .description('Compile and install Hugsy configuration to Claude Code')
    .argument('[packages...]', 'Packages to install (plugins or presets)')
    .option('-f, --force', 'Overwrite existing configuration')
    .option('-v, --verbose', 'Show detailed compilation process')
    .option('--no-backup', 'Skip backup of existing settings')
    .option('--plugin', 'Treat packages as plugins')
    .option('--preset', 'Treat packages as presets')
    .action(async (packages, options) => {
      // If packages are provided, install them
      if (packages && packages.length > 0) {
        logger.section('Installing Packages');

        // Check if .hugsyrc.json exists
        if (!ProjectConfig.exists()) {
          logger.error('No .hugsyrc.json found. Run "hugsy init" first to create configuration.');
          return;
        }

        let hasChanges = false;

        for (const pkg of packages) {
          logger.divider();

          // Detect package type
          const type = detectPackageType(pkg, options);
          logger.info(`Processing ${pkg} as ${type}`);

          // Install npm package (if not a local file)
          if (!pkg.startsWith('./') && !pkg.startsWith('../') && !pkg.startsWith('/')) {
            const installed = installNpmPackage(pkg);
            if (!installed) {
              logger.error(`Failed to install ${pkg}, skipping...`);
              continue;
            }
          }

          // Update configuration
          const updated = updateHugsyConfig(pkg, type);
          if (updated) {
            hasChanges = true;
          }
        }

        // If configuration was updated, compile it
        if (hasChanges) {
          logger.divider();
          logger.section('Compiling Configuration');
        } else {
          logger.info('No configuration changes made');
          return;
        }
      } else {
        // Original behavior: just compile existing configuration
        logger.section('Installing Hugsy');
      }

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
            logger.warning('Project already has .claude/settings.json');

            // Skip interactive prompt if not in TTY (non-interactive mode)
            const isTTY = process.stdin.isTTY;

            if (!isTTY) {
              logger.info('Use --force to overwrite in non-interactive mode');
              return;
            }

            const { overwrite } = await prompts({
              type: 'confirm',
              name: 'overwrite',
              message: 'Do you want to overwrite the existing settings?',
              initial: false,
            });

            if (!overwrite) {
              logger.info('Installation cancelled');
              return;
            }
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
        
        // Check if .claude is in .gitignore
        const gitignorePath = join(process.cwd(), '.gitignore');
        let shouldShowCommitWarning = false; // Default to false - only show if in gitignore
        
        if (existsSync(gitignorePath)) {
          try {
            const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
            // Check if .claude or .claude/ is in gitignore
            const lines = gitignoreContent.split('\n');
            const hasClaudeIgnored = lines.some(line => {
              const trimmed = line.trim();
              // Skip comments and empty lines
              if (!trimmed || trimmed.startsWith('#')) return false;
              
              // Check for various patterns that would ignore .claude, .claude/settings.json, or .claude/commands
              // We specifically check if these critical files would be ignored
              
              // Direct matches for whole .claude directory
              if (trimmed === '.claude' || 
                  trimmed === '.claude/' || 
                  trimmed === '/.claude' ||
                  trimmed === '/.claude/' ||
                  trimmed === '.claude/*' ||
                  trimmed === '.claude/**') {
                return true;
              }
              
              // Direct matches for settings.json
              if (trimmed === '.claude/settings.json' ||
                  trimmed === '/.claude/settings.json') {
                return true;
              }
              
              // Direct matches for commands directory
              if (trimmed === '.claude/commands' ||
                  trimmed === '.claude/commands/' ||
                  trimmed === '.claude/commands/*' ||
                  trimmed === '.claude/commands/**') {
                return true;
              }
              
              // Wildcard patterns that would match settings.json or commands
              if (trimmed.includes('*')) {
                // Patterns that would match settings.json
                if (trimmed === '.claude/*.json' || 
                    trimmed === '.claude/settings.*' ||
                    trimmed === '.claude/*.settings.json') {
                  return true;
                }
                // Patterns that would match commands directory
                if (trimmed === '.claude/comm*' ||
                    trimmed === '.claude/*/') {
                  return true;
                }
              }
              
              return false;
            });
            
            if (hasClaudeIgnored) {
              shouldShowCommitWarning = true; // Show warning because it's ignored
              if (options.verbose) {
                logger.info('.claude directory is in .gitignore, will show commit warning');
              }
            } else if (options.verbose) {
              logger.info('.claude directory is NOT in .gitignore, skipping commit warning');
            }
          } catch {
            // If we can't read .gitignore, show the warning anyway
            if (options.verbose) {
              logger.warning('Could not read .gitignore, showing commit warning');
            }
          }
        }
        
        if (shouldShowCommitWarning) {
          logger.warning('Make sure to commit .claude/settings.json to version control');
        }
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
