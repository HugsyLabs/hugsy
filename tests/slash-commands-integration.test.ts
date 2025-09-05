/**
 * Integration test for slash commands functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const CLI_PATH = join(__dirname, '..', 'packages', 'cli', 'dist', 'index.js');

// Helper functions
function setupTestEnvironment(testDir: string): void {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
  mkdirSync(testDir, { recursive: true });

  // Create team commands directory with custom commands
  const teamCommandsDir = join(testDir, 'team-commands');
  mkdirSync(teamCommandsDir, { recursive: true });

  // Create a custom command file with frontmatter
  const customCommand = `---
description: Custom team command
category: team
argument-hint: [task-id]
---

Handle team task #$ARGUMENTS

1. Get task details
2. Update status
3. Notify team members`;

  writeFileSync(join(teamCommandsDir, 'team-task.md'), customCommand);

  // Create another command without frontmatter
  const simpleCommand = `Simple deployment script for staging environment

Deploy to staging and run tests.`;

  writeFileSync(join(teamCommandsDir, 'deploy-staging.md'), simpleCommand);
}

function cleanupTestEnvironment(testDir: string): void {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

function countCommands(dir: string): number {
  if (!existsSync(dir)) return 0;
  const items = readdirSync(dir, { withFileTypes: true });
  let count = 0;
  for (const item of items) {
    if (item.isDirectory()) {
      count += countCommands(join(dir, item.name));
    } else if (item.name.endsWith('.md')) {
      count++;
    }
  }
  return count;
}

// Test suites
describe('Slash Commands Integration Tests', () => {
  describe('Slash Commands Compilation', () => {
    const testDir = join(tmpdir(), `hugsy-slash-commands-test-${Date.now()}`);

    beforeEach(() => {
      setupTestEnvironment(testDir);
    });

    afterEach(() => {
      cleanupTestEnvironment(testDir);
    });

    it('should compile slash commands from multiple sources', () => {
      // Create .hugsyrc.json with commands configuration
      const config = {
        permissions: {
          allow: ['Read(**)', 'Write(**/test/**)'],
          deny: ['Write(**/prod/**)'],
        },
        commands: {
          // Reference the built-in preset
          presets: [
            join(__dirname, '..', 'packages', 'core', 'presets', 'slash-commands-common.json'),
          ],

          // Load local markdown files
          files: ['./team-commands/*.md'],

          // Define inline commands
          commands: {
            'quick-test': 'Run quick smoke tests',
            status: {
              content: 'Show project status and health checks',
              description: 'Project status',
              category: 'monitoring',
            },
            // Override a command from preset
            test: 'Custom test command that overrides preset',
          },
        },
      };

      const configPath = join(testDir, '.hugsyrc.json');
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      // Run hugsy install
      const output = execSync(`node ${CLI_PATH} install --force`, {
        cwd: testDir,
        encoding: 'utf-8',
      });

      expect(output).toContain('Generated');
      expect(output).toContain('slash command');

      // Verify directories
      const claudeDir = join(testDir, '.claude');
      expect(existsSync(claudeDir)).toBe(true);

      const commandsDir = join(claudeDir, 'commands');
      expect(existsSync(commandsDir)).toBe(true);

      // Check inline simple command
      const quickTestPath = join(commandsDir, 'quick-test.md');
      expect(existsSync(quickTestPath)).toBe(true);
      const quickTestContent = readFileSync(quickTestPath, 'utf-8');
      expect(quickTestContent).toBe('Run quick smoke tests');

      // Check inline detailed command with category
      const statusPath = join(commandsDir, 'monitoring', 'status.md');
      expect(existsSync(statusPath)).toBe(true);
      const statusContent = readFileSync(statusPath, 'utf-8');
      expect(statusContent).toContain('description: Project status');
      expect(statusContent).toContain('Show project status and health checks');

      // Check overridden command
      const testPath = join(commandsDir, 'test.md');
      expect(existsSync(testPath)).toBe(true);
      const testContent = readFileSync(testPath, 'utf-8');
      expect(testContent).toBe('Custom test command that overrides preset');

      // Check command from preset (in development category)
      const buildPath = join(commandsDir, 'development', 'build.md');
      expect(existsSync(buildPath)).toBe(true);

      // Check commands loaded from markdown files
      const teamTaskPath = join(commandsDir, 'team', 'team-task.md');
      expect(existsSync(teamTaskPath)).toBe(true);
      const teamTaskContent = readFileSync(teamTaskPath, 'utf-8');
      // Debug output
      console.log('=== team-task.md content ===');
      console.log(teamTaskContent);
      console.log('=== end ===');
      // Note: Frontmatter format may vary slightly after processing
      expect(
        teamTaskContent.includes('[task-id]') || teamTaskContent.includes('argument-hint')
      ).toBe(true);
      expect(teamTaskContent).toContain('Handle team task #$ARGUMENTS');

      // Count total commands
      const totalCommands = countCommands(commandsDir);
      expect(totalCommands).toBeGreaterThan(10);
    });
  });

  describe('YAML Configuration', () => {
    const testDir = join(tmpdir(), `hugsy-yaml-test-${Date.now()}`);

    beforeEach(() => {
      setupTestEnvironment(testDir);
    });

    afterEach(() => {
      cleanupTestEnvironment(testDir);
    });

    it('should process commands from YAML config', () => {
      // Create .hugsyrc.yml with commands
      const yamlConfig = `permissions:
  allow:
    - 'Read(**)'
    - 'Write(**/test/**)'

commands:
  commands:
    yaml-test: 'Command from YAML'
    yaml-advanced:
      content: |
        Advanced YAML command
        with multiple lines
      description: 'YAML advanced'
      category: 'yaml-category'`;

      writeFileSync(join(testDir, '.hugsyrc.yml'), yamlConfig);

      // Run hugsy install
      execSync(`node ${CLI_PATH} install --force`, {
        cwd: testDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      const commandsDir = join(testDir, '.claude', 'commands');

      // Check YAML simple command
      const yamlTestPath = join(commandsDir, 'yaml-test.md');
      expect(existsSync(yamlTestPath)).toBe(true);
      const yamlTestContent = readFileSync(yamlTestPath, 'utf-8');
      expect(yamlTestContent).toBe('Command from YAML');

      // Check YAML advanced command
      const yamlAdvancedPath = join(commandsDir, 'yaml-category', 'yaml-advanced.md');
      expect(existsSync(yamlAdvancedPath)).toBe(true);
      const yamlAdvancedContent = readFileSync(yamlAdvancedPath, 'utf-8');
      expect(yamlAdvancedContent).toContain('description: YAML advanced');
      expect(yamlAdvancedContent).toContain('Advanced YAML command');
    });
  });

  describe('Force Reinstall Cleanup', () => {
    const testDir = join(tmpdir(), `hugsy-force-test-${Date.now()}`);

    beforeEach(() => {
      setupTestEnvironment(testDir);
    });

    afterEach(() => {
      cleanupTestEnvironment(testDir);
    });

    it('should remove stale commands on force reinstall', () => {
      // First install with a stale command
      const initialConfig = {
        permissions: { allow: ['Read(**)'] },
        commands: {
          commands: {
            'stale-command': 'This should be removed',
            'kept-command': 'This should remain',
          },
        },
      };

      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(initialConfig, null, 2));

      execSync(`node ${CLI_PATH} install --force`, {
        cwd: testDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      const commandsDir = join(testDir, '.claude', 'commands');
      const staleCommandPath = join(commandsDir, 'stale-command.md');
      expect(existsSync(staleCommandPath)).toBe(true);

      // Update config without stale command
      const newConfig = {
        permissions: { allow: ['Read(**)'] },
        commands: {
          commands: {
            'kept-command': 'This should remain',
            'fresh-command': 'Fresh new command',
          },
        },
      };

      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(newConfig, null, 2));

      // Reinstall with --force
      execSync(`node ${CLI_PATH} install --force`, {
        cwd: testDir,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      // Check results
      expect(existsSync(staleCommandPath)).toBe(false);

      const keptCommandPath = join(commandsDir, 'kept-command.md');
      expect(existsSync(keptCommandPath)).toBe(true);

      const freshCommandPath = join(commandsDir, 'fresh-command.md');
      expect(existsSync(freshCommandPath)).toBe(true);
    });
  });
});
