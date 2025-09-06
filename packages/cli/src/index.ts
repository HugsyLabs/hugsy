#!/usr/bin/env node

/**
 * Hugsy CLI - Configuration management for Claude Code
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';

// Import commands
import { installCommand } from './commands/install.js';
import { initCommand } from './commands/init.js';
import { uninstallCommand } from './commands/uninstall.js';
import { statusCommand } from './commands/status.js';
import { uiCommand } from './commands/ui.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packagePath = join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

// Create main program
const program = new Command();

program
  .name('hugsy')
  .description('CLI for Hugsy - Configuration management for Claude Code')
  .version(packageJson.version)
  .addHelpText(
    'after',
    `
${chalk.gray('Examples:')}
  ${chalk.cyan('hugsy ui')}              Launch the web UI
  ${chalk.cyan('hugsy init')}            Initialize configuration  
  ${chalk.cyan('hugsy install')}         Install Hugsy to Claude Code
  ${chalk.cyan('hugsy status')}          Show current status
  ${chalk.cyan('hugsy uninstall')}       Remove Hugsy from Claude Code

${chalk.gray('Documentation:')}
  https://github.com/HugsyLab/hugsy
`
  );

// Add commands
program.addCommand(installCommand());
program.addCommand(initCommand());
program.addCommand(uninstallCommand());
program.addCommand(statusCommand());
program.addCommand(uiCommand());

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
