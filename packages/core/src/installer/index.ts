/**
 * InstallManager - Handles writing compiled configuration to filesystem
 */

import { writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, copyFileSync } from 'fs';
import { join } from 'path';
import type { ClaudeSettings, SlashCommand, Subagent } from '@hugsylabs/hugsy-types';

export interface InstallOptions {
  projectRoot: string;
  force?: boolean;
  verbose?: boolean;
  backup?: boolean;
}

export interface InstallResult {
  success: boolean;
  settingsPath: string;
  commandsPath?: string;
  commandsCount?: number;
  agentsPath?: string;
  agentsCount?: number;
  backupPath?: string;
  message: string;
  errors?: string[];
}

export class InstallManager {
  private projectRoot: string;
  private options: InstallOptions;

  constructor(options: InstallOptions) {
    this.options = options;
    this.projectRoot = options.projectRoot;
  }

  /**
   * Install compiled settings, commands, and subagents to .claude directory
   */
  install(
    settings: ClaudeSettings,
    commands?: Map<string, SlashCommand>,
    subagents?: Map<string, Subagent>
  ): InstallResult {
    const errors: string[] = [];
    const claudeDir = join(this.projectRoot, '.claude');
    const settingsPath = join(claudeDir, 'settings.json');
    const commandsDir = join(claudeDir, 'commands');
    const agentsDir = join(claudeDir, 'agents');

    try {
      // 1. Create .claude directory if needed
      if (!existsSync(claudeDir)) {
        mkdirSync(claudeDir, { recursive: true });
        this.log('Created .claude directory');
      }

      // 2. Check for existing settings
      let backupPath: string | undefined;
      if (existsSync(settingsPath)) {
        if (!this.options.force) {
          return {
            success: false,
            settingsPath,
            message: 'Settings file already exists. Use force option to overwrite.',
            errors: ['Settings file already exists'],
          };
        }

        // Create backup if requested
        if (this.options.backup) {
          backupPath = this.createBackup(settingsPath);
          this.log(`Created backup: ${backupPath}`);
        }
      }

      // 3. Write settings.json
      this.writeSettings(settings, settingsPath);
      this.log('Wrote settings.json');

      // 4. Write slash commands if provided
      let commandsCount = 0;
      if (commands && commands.size > 0) {
        commandsCount = this.writeCommands(commands, commandsDir);
        this.log(`Wrote ${commandsCount} slash commands`);
      }

      // 5. Write subagents if provided
      let agentsCount = 0;
      if (subagents && subagents.size > 0) {
        agentsCount = this.writeSubagents(subagents, agentsDir);
        this.log(`Wrote ${agentsCount} subagents`);
      }

      return {
        success: true,
        settingsPath,
        commandsPath: commands && commands.size > 0 ? commandsDir : undefined,
        commandsCount,
        agentsPath: subagents && subagents.size > 0 ? agentsDir : undefined,
        agentsCount,
        backupPath,
        message: 'Installation completed successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);

      return {
        success: false,
        settingsPath,
        message: `Installation failed: ${errorMessage}`,
        errors,
      };
    }
  }

  /**
   * Write settings to file
   */
  private writeSettings(settings: ClaudeSettings, path: string): void {
    const content = JSON.stringify(settings, null, 2);
    writeFileSync(path, content, 'utf-8');
  }

  /**
   * Write slash commands to files
   */
  private writeCommands(commands: Map<string, SlashCommand>, commandsDir: string): number {
    // Clean existing commands directory if force flag is set
    if (this.options.force && existsSync(commandsDir)) {
      rmSync(commandsDir, { recursive: true, force: true });
      this.log('Cleaned existing commands directory');
    }

    // Create commands directory
    if (!existsSync(commandsDir)) {
      mkdirSync(commandsDir, { recursive: true });
    }

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

      if (this.options.verbose) {
        const relativePath = command.category ? `${command.category}/${name}` : name;
        this.log(`  Created command: /${name} → commands/${relativePath}.md`);
      }
    }

    return commandCount;
  }

  /**
   * Write subagents to files
   */
  private writeSubagents(subagents: Map<string, Subagent>, agentsDir: string): number {
    // Clean existing agents directory if force flag is set
    if (this.options.force && existsSync(agentsDir)) {
      rmSync(agentsDir, { recursive: true, force: true });
      this.log('Cleaned existing agents directory');
    }

    // Create agents directory
    if (!existsSync(agentsDir)) {
      mkdirSync(agentsDir, { recursive: true });
    }

    let agentCount = 0;
    for (const [name, agent] of subagents) {
      const fileName = `${name}.md`;
      const filePath = join(agentsDir, fileName);

      // Build agent content with frontmatter
      let content = '---\n';
      content += `name: ${agent.name}\n`;
      content += `description: ${agent.description}\n`;
      if (agent.tools && agent.tools.length > 0) {
        content += `tools: ${agent.tools.join(', ')}\n`;
      }
      content += '---\n\n';
      content += agent.content;

      writeFileSync(filePath, content);
      agentCount++;

      if (this.options.verbose) {
        this.log(`  Created agent: ${name} → agents/${name}.md`);
      }
    }

    return agentCount;
  }

  /**
   * Create backup of existing file
   */
  private createBackup(filePath: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;
    copyFileSync(filePath, backupPath);
    return backupPath;
  }

  /**
   * Check if settings already exist
   */
  checkExisting(): { exists: boolean; path?: string } {
    const settingsPath = join(this.projectRoot, '.claude', 'settings.json');
    if (existsSync(settingsPath)) {
      return { exists: true, path: settingsPath };
    }
    return { exists: false };
  }

  /**
   * Uninstall settings and commands
   */
  uninstall(options?: {
    keepSettings?: boolean;
    keepCommands?: boolean;
    keepAgents?: boolean;
  }): InstallResult {
    const claudeDir = join(this.projectRoot, '.claude');
    const settingsPath = join(claudeDir, 'settings.json');
    const commandsDir = join(claudeDir, 'commands');
    const agentsDir = join(claudeDir, 'agents');
    const removed: string[] = [];

    try {
      // Remove settings.json
      if (!options?.keepSettings && existsSync(settingsPath)) {
        rmSync(settingsPath);
        removed.push('settings.json');
      }

      // Remove commands directory
      if (!options?.keepCommands && existsSync(commandsDir)) {
        rmSync(commandsDir, { recursive: true, force: true });
        removed.push('commands directory');
      }

      // Remove agents directory
      if (!options?.keepAgents && existsSync(agentsDir)) {
        rmSync(agentsDir, { recursive: true, force: true });
        removed.push('agents directory');
      }

      // Remove .claude directory if empty
      if (existsSync(claudeDir)) {
        const files = readdirSync(claudeDir);
        if (files.length === 0) {
          rmSync(claudeDir, { recursive: true });
          removed.push('.claude directory');
        }
      }

      return {
        success: true,
        settingsPath,
        message: `Uninstalled: ${removed.join(', ')}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        settingsPath,
        message: `Uninstall failed: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Log verbose messages
   */
  private log(message: string): void {
    if (this.options.verbose) {
      console.log(`[InstallManager] ${message}`);
    }
  }
}
