/**
 * Claude Code settings.json utilities
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { logger } from './logger.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');
const BACKUP_PATH = join(CLAUDE_DIR, 'settings.json.hugsy-backup');

interface HookEntry {
  matcher: string;
  hooks: {
    type: string;
    command: string;
    timeout?: number;
  }[];
}

interface ClaudeSettings {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

export class ClaudeConfig {
  /**
   * Check if Claude Code settings exist
   */
  static exists(): boolean {
    return existsSync(SETTINGS_PATH);
  }

  /**
   * Read Claude Code settings
   */
  static read(): ClaudeSettings | null {
    try {
      if (!this.exists()) {
        return null;
      }
      const content = readFileSync(SETTINGS_PATH, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error(`Failed to read Claude settings: ${String(error)}`);
      return null;
    }
  }

  /**
   * Write Claude Code settings
   */
  static write(settings: ClaudeSettings): boolean {
    try {
      // Ensure directory exists
      if (!existsSync(CLAUDE_DIR)) {
        mkdirSync(CLAUDE_DIR, { recursive: true });
      }

      // Write settings with proper formatting
      const content = JSON.stringify(settings, null, 2);
      writeFileSync(SETTINGS_PATH, content);
      return true;
    } catch (error) {
      logger.error(`Failed to write Claude settings: ${String(error)}`);
      return false;
    }
  }

  /**
   * Backup current settings
   */
  static backup(): boolean {
    try {
      if (this.exists()) {
        const content = readFileSync(SETTINGS_PATH);
        writeFileSync(BACKUP_PATH, content);
        logger.debug(`Backed up settings to ${BACKUP_PATH}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Failed to backup settings: ${String(error)}`);
      return false;
    }
  }

  /**
   * Restore from backup
   */
  static restore(): boolean {
    try {
      if (existsSync(BACKUP_PATH)) {
        const content = readFileSync(BACKUP_PATH);
        writeFileSync(SETTINGS_PATH, content);
        logger.success('Restored settings from backup');
        return true;
      }
      logger.warn('No backup found');
      return false;
    } catch (error) {
      logger.error(`Failed to restore backup: ${String(error)}`);
      return false;
    }
  }

  /**
   * Check if Hugsy is installed
   */
  static isHugsyInstalled(): boolean {
    const settings = this.read();
    if (!settings?.hooks?.PreToolUse) {
      return false;
    }

    // Check if any PreToolUse hook contains hugsy
    return settings.hooks.PreToolUse.some((entry) =>
      entry.hooks.some((hook) => hook.command?.toLowerCase().includes('hugsy'))
    );
  }

  /**
   * Add Hugsy hook
   */
  static addHugsyHook(hookPath: string): boolean {
    const settings = this.read() ?? {};

    // Initialize hooks structure if needed
    settings.hooks ??= {};
    if (!settings.hooks.PreToolUse) {
      settings.hooks.PreToolUse = [];
    }

    // Check if already installed
    if (this.isHugsyInstalled()) {
      logger.warn('Hugsy is already installed');
      return true;
    }

    // Find or create the .* matcher entry
    let matcherEntry = settings.hooks.PreToolUse.find((e) => e.matcher === '.*');
    if (!matcherEntry) {
      matcherEntry = {
        matcher: '.*',
        hooks: [],
      };
      settings.hooks.PreToolUse.push(matcherEntry);
    }

    // Add Hugsy hook
    matcherEntry.hooks.push({
      type: 'command',
      command: `node ${hookPath}`,
      timeout: 3000,
    });

    return this.write(settings);
  }

  /**
   * Remove Hugsy hook
   */
  static removeHugsyHook(): boolean {
    const settings = this.read();
    if (!settings?.hooks?.PreToolUse) {
      return true;
    }

    // Remove Hugsy hooks from all entries
    settings.hooks.PreToolUse.forEach((entry) => {
      entry.hooks = entry.hooks.filter((hook) => !hook.command?.toLowerCase().includes('hugsy'));
    });

    // Remove empty entries
    settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter((entry) => entry.hooks.length > 0);

    return this.write(settings);
  }

  /**
   * Get Hugsy hook path if installed
   */
  static getHugsyHookPath(): string | null {
    const settings = this.read();
    if (!settings?.hooks?.PreToolUse) {
      return null;
    }

    for (const entry of settings.hooks.PreToolUse) {
      for (const hook of entry.hooks) {
        if (hook.command?.toLowerCase().includes('hugsy')) {
          // Extract path from command
          const match = /node\s+(.+)/.exec(hook.command);
          return match ? match[1] : null;
        }
      }
    }

    return null;
  }
}
