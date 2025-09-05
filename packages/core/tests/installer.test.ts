import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InstallManager } from '../src/installer/index.js';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ClaudeSettings, SlashCommand } from '@hugsylabs/hugsy-types';

describe('InstallManager', () => {
  const testDir = '/tmp/hugsy-installer-test-' + Date.now();
  let installer: InstallManager;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    installer = new InstallManager({ projectRoot: testDir });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('checkExisting', () => {
    it('should return false when settings do not exist', () => {
      const result = installer.checkExisting();
      expect(result.exists).toBe(false);
      expect(result.path).toBeUndefined();
    });

    it('should return true when settings exist', () => {
      const claudeDir = join(testDir, '.claude');
      const settingsPath = join(claudeDir, 'settings.json');
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(settingsPath, '{}');

      const result = installer.checkExisting();
      expect(result.exists).toBe(true);
      expect(result.path).toBe(settingsPath);
    });
  });

  describe('install', () => {
    const mockSettings: ClaudeSettings = {
      permissions: {
        allow: ['Read(**)', 'Write(**)'],
        deny: [],
        ask: [],
      },
    };

    it('should install settings successfully', () => {
      const result = installer.install(mockSettings);

      expect(result.success).toBe(true);
      expect(result.settingsPath).toBe(join(testDir, '.claude', 'settings.json'));
      expect(existsSync(join(testDir, '.claude', 'settings.json'))).toBe(true);

      const savedSettings = JSON.parse(
        readFileSync(join(testDir, '.claude', 'settings.json'), 'utf-8')
      );
      expect(savedSettings).toEqual(mockSettings);
    });

    it('should fail if settings exist without force', () => {
      const claudeDir = join(testDir, '.claude');
      const settingsPath = join(claudeDir, 'settings.json');
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(settingsPath, '{"existing": true}');

      const result = installer.install(mockSettings);

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
      expect(result.errors).toBeDefined();

      // Verify existing settings not overwritten
      const savedSettings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      expect(savedSettings.existing).toBe(true);
    });

    it('should overwrite with force option', () => {
      const claudeDir = join(testDir, '.claude');
      const settingsPath = join(claudeDir, 'settings.json');
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(settingsPath, '{"existing": true}');

      const forceInstaller = new InstallManager({
        projectRoot: testDir,
        force: true,
      });
      const result = forceInstaller.install(mockSettings);

      expect(result.success).toBe(true);
      const savedSettings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      expect(savedSettings).toEqual(mockSettings);
    });

    it('should install slash commands', () => {
      const commands = new Map<string, SlashCommand>([
        [
          'test-cmd',
          {
            name: 'test-cmd',
            content: 'Test command content',
            description: 'Test command',
          },
        ],
        [
          'help',
          {
            name: 'help',
            content: 'Help content',
            category: 'docs',
          },
        ],
      ]);

      const result = installer.install(mockSettings, commands);

      expect(result.success).toBe(true);
      expect(result.commandsCount).toBe(2);
      expect(result.commandsPath).toBe(join(testDir, '.claude', 'commands'));

      // Check command files
      expect(existsSync(join(testDir, '.claude', 'commands', 'test-cmd.md'))).toBe(true);
      expect(existsSync(join(testDir, '.claude', 'commands', 'docs', 'help.md'))).toBe(true);

      const testCmdContent = readFileSync(
        join(testDir, '.claude', 'commands', 'test-cmd.md'),
        'utf-8'
      );
      expect(testCmdContent).toContain('description: Test command');
      expect(testCmdContent).toContain('Test command content');
    });

    it('should handle command with frontmatter', () => {
      const commands = new Map<string, SlashCommand>([
        [
          'api',
          {
            name: 'api',
            content: 'API command content',
            description: 'API helper',
            argumentHint: '[endpoint]',
            model: 'claude-3-sonnet',
            allowedTools: ['WebSearch', 'Read'],
          },
        ],
      ]);

      installer.install(mockSettings, commands);

      const cmdContent = readFileSync(join(testDir, '.claude', 'commands', 'api.md'), 'utf-8');
      expect(cmdContent).toContain('description: API helper');
      expect(cmdContent).toContain('argument-hint: [endpoint]');
      expect(cmdContent).toContain('model: claude-3-sonnet');
      expect(cmdContent).toContain('allowed-tools: WebSearch, Read');
    });
  });

  describe('uninstall', () => {
    beforeEach(() => {
      // Setup installed files
      const claudeDir = join(testDir, '.claude');
      const commandsDir = join(claudeDir, 'commands');
      mkdirSync(commandsDir, { recursive: true });
      writeFileSync(join(claudeDir, 'settings.json'), '{}');
      writeFileSync(join(commandsDir, 'test.md'), 'test');
    });

    it('should uninstall settings and commands', () => {
      const result = installer.uninstall();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Uninstalled');
      expect(existsSync(join(testDir, '.claude', 'settings.json'))).toBe(false);
      expect(existsSync(join(testDir, '.claude', 'commands'))).toBe(false);
      expect(existsSync(join(testDir, '.claude'))).toBe(false);
    });

    it('should keep settings with keepSettings option', () => {
      const result = installer.uninstall({ keepSettings: true });

      expect(result.success).toBe(true);
      expect(existsSync(join(testDir, '.claude', 'settings.json'))).toBe(true);
      expect(existsSync(join(testDir, '.claude', 'commands'))).toBe(false);
    });

    it('should keep commands with keepCommands option', () => {
      const result = installer.uninstall({ keepCommands: true });

      expect(result.success).toBe(true);
      expect(existsSync(join(testDir, '.claude', 'settings.json'))).toBe(false);
      expect(existsSync(join(testDir, '.claude', 'commands'))).toBe(true);
    });

    it('should handle uninstall when nothing exists', () => {
      // Clean everything first
      rmSync(join(testDir, '.claude'), { recursive: true, force: true });

      const result = installer.uninstall();
      expect(result.success).toBe(true);
    });
  });

  describe('verbose logging', () => {
    it('should log when verbose is enabled', () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);

      const verboseInstaller = new InstallManager({
        projectRoot: testDir,
        verbose: true,
      });

      const settings: ClaudeSettings = {
        permissions: { allow: [], deny: [], ask: [] },
      };
      verboseInstaller.install(settings);

      console.log = originalLog;

      expect(logs.some((log) => log.includes('[InstallManager]'))).toBe(true);
      expect(logs.some((log) => log.includes('Created .claude directory'))).toBe(true);
    });
  });
});
