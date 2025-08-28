/**
 * Integration tests for Hugsy CLI
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { spawn } from 'child_process';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = join(__dirname, '../packages/cli/dist/index.js');
const TEST_DIR = '/tmp/hugsy-test-' + Date.now();
const SNAPSHOTS_DIR = join(__dirname, 'snapshots');

// Test directory will be created for each test suite
let currentTestDir: string | null = null;

interface TestResult {
  stdout: string;
  stderr: string;
  code: number;
}

// Test utilities
function runCommand(command: string, args: string[] = [], input: string = ''): Promise<TestResult> {
  return new Promise<TestResult>((resolve) => {
    const testDir = currentTestDir || TEST_DIR;
    const proc = spawn('node', [CLI_PATH, command, ...args], {
      cwd: testDir,
      env: { ...process.env, NODE_ENV: 'test', NO_COLOR: '1' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => (stdout += data.toString()));
    proc.stderr.on('data', (data) => (stderr += data.toString()));

    if (input) {
      proc.stdin.write(input);
      proc.stdin.end();
    }

    proc.on('close', (code: number | null) => {
      resolve({ code: code || 0, stdout, stderr });
    });
  });
}

function assertFileExists(path: string, message?: string): void {
  expect(existsSync(path), message || `File should exist: ${path}`).toBe(true);
}

function assertFileNotExists(path: string, message?: string): void {
  expect(existsSync(path), message || `File should not exist: ${path}`).toBe(false);
}

function assertJsonContent<T = any>(
  path: string,
  validator: (content: T) => boolean,
  message?: string
): T {
  assertFileExists(path);
  const content = JSON.parse(readFileSync(path, 'utf-8'));
  expect(validator(content), message || 'JSON content validation failed').toBe(true);
  return content;
}

function assertSnapshot(actual: any, snapshotName: string): void {
  // Use Vitest's built-in snapshot functionality
  expect(actual).toMatchSnapshot(snapshotName);
}

// Test setup and cleanup
const testEnvironment = {
  async setup(dir?: string): Promise<void> {
    const testDir = dir || TEST_DIR;
    mkdirSync(testDir, { recursive: true });
    currentTestDir = testDir;
  },

  async cleanup(dir?: string): Promise<void> {
    const testDir = dir || currentTestDir || TEST_DIR;
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    currentTestDir = null;
  },

  async reset(dir?: string) {
    await this.cleanup(dir);
    await this.setup(dir);
  },
};

// Test suites
describe('Hugsy CLI Integration Tests', () => {
  describe('Basic Commands', () => {
    const testDir = '/tmp/hugsy-test-basic-' + Date.now();

    beforeAll(async () => {
      await testEnvironment.setup(testDir);
    });

    afterAll(async () => {
      await testEnvironment.cleanup(testDir);
    });

    it('should show help', async () => {
      const helpResult = await runCommand('--help');
      expect(helpResult.code).toBe(0);
      expect(helpResult.stdout).toContain('init');
      expect(helpResult.stdout).toContain('install');
    });

    it('should show version', async () => {
      const versionResult = await runCommand('--version');
      expect(versionResult.code).toBe(0);
      expect(versionResult.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('Configuration Initialization', () => {
    const testDir = '/tmp/hugsy-test-init-' + Date.now();

    beforeAll(async () => {
      await testEnvironment.setup(testDir);
    });

    afterAll(async () => {
      await testEnvironment.cleanup(testDir);
    });

    it('should init with recommended preset', async () => {
      const result = await runCommand('init', [], '1\n');
      expect(result.code).toBe(0);

      const configPath = join(testDir, '.hugsyrc.json');
      const config = assertJsonContent(
        configPath,
        (c) => c.extends === '@hugsy/recommended' && c.env?.NODE_ENV === 'development',
        'Config has correct structure'
      );

      assertSnapshot(config, 'init-recommended-config');
    });

    it('should fail when config exists', async () => {
      const existingResult = await runCommand('init', [], '1\n');
      expect(existingResult.code !== 0 || existingResult.stderr.length > 0).toBe(true);
    });

    it('should force overwrite with --force', async () => {
      const forceResult = await runCommand('init', ['--force'], '1\n');
      expect(forceResult.code).toBe(0);

      const configPath = join(testDir, '.hugsyrc.json');
      assertFileExists(configPath);
    });
  });

  describe('Installation Process', () => {
    const testDir = '/tmp/hugsy-test-install-' + Date.now();

    beforeAll(async () => {
      await testEnvironment.setup(testDir);
      // Setup config first
      await runCommand('init', [], '1\n');
    });

    afterAll(async () => {
      await testEnvironment.cleanup(testDir);
    });

    it('should install successfully', async () => {
      const result = await runCommand('install');
      expect(result.code).toBe(0);

      const settingsPath = join(testDir, '.claude', 'settings.json');
      const settings = assertJsonContent(
        settingsPath,
        (s) => {
          return (
            s.permissions?.allow &&
            s.permissions?.deny &&
            s.permissions?.ask &&
            Array.isArray(s.permissions.allow) &&
            Array.isArray(s.permissions.deny)
          );
        },
        'Settings has valid permission structure'
      );

      expect(settings.env?.NODE_ENV).toBe('development');
      // No defaults should be added if not specified
      expect(settings.includeCoAuthoredBy).toBeUndefined();
      expect(settings.cleanupPeriodDays).toBeUndefined();

      assertSnapshot(settings, 'install-compiled-settings');
    });

    it('should reinstall with --force', async () => {
      const reinstallResult = await runCommand('install', ['--force']);
      expect(reinstallResult.code).toBe(0);
    });
  });

  describe('Status Command', () => {
    const testDir = '/tmp/hugsy-test-status-' + Date.now();

    beforeAll(async () => {
      await testEnvironment.setup(testDir);
    });

    afterAll(async () => {
      await testEnvironment.cleanup(testDir);
    });

    it('should work without config', async () => {
      const result = await runCommand('status');
      expect(result.code).toBe(0);
    });

    it('should work with config only', async () => {
      await runCommand('init', [], '1\n');
      const result = await runCommand('status');
      expect(result.code).toBe(0);
      assertFileExists(join(testDir, '.hugsyrc.json'));
    });

    it('should work after installation', async () => {
      await runCommand('install');
      const result = await runCommand('status');
      expect(result.code).toBe(0);
    });

    it('should show verbose output', async () => {
      const normalResult = await runCommand('status');
      const verboseResult = await runCommand('status', ['--verbose']);
      expect(verboseResult.code).toBe(0);
      expect(verboseResult.stdout.length).toBeGreaterThan(normalResult.stdout.length);
    });
  });

  describe('Uninstallation', () => {
    const testDir = '/tmp/hugsy-test-uninstall-' + Date.now();

    beforeAll(async () => {
      await testEnvironment.setup(testDir);
    });

    afterAll(async () => {
      await testEnvironment.cleanup(testDir);
    });

    it('should uninstall and remove config', async () => {
      // Setup first
      await runCommand('init', [], '1\n');
      await runCommand('install');

      const configPath = join(testDir, '.hugsyrc.json');
      const settingsPath = join(testDir, '.claude', 'settings.json');

      const result = await runCommand('uninstall', ['-y']);
      expect(result.code).toBe(0);
      assertFileNotExists(configPath);
      assertFileExists(settingsPath);
    });

    it('should keep config with --keep-config', async () => {
      // Setup again
      await runCommand('init', [], '1\n');
      await runCommand('install');

      const configPath = join(testDir, '.hugsyrc.json');
      const result = await runCommand('uninstall', ['--keep-config', '-y']);
      expect(result.code).toBe(0);
      assertFileExists(configPath);
    });

    it('should handle nothing to uninstall', async () => {
      await testEnvironment.reset(testDir);
      const result = await runCommand('uninstall', ['-y']);
      expect(result.code).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    const testDir = '/tmp/hugsy-test-edge-' + Date.now();

    beforeAll(async () => {
      await testEnvironment.setup(testDir);
    });

    afterAll(async () => {
      await testEnvironment.cleanup(testDir);
    });

    it('should fail install without init', async () => {
      const result = await runCommand('install');
      expect(
        result.code !== 0 || result.stderr.length > 0 || result.stdout.includes('No .hugsyrc.json')
      ).toBe(true);
    });

    it('should handle invalid preset selection', async () => {
      const result = await runCommand('init', [], '99\n');
      expect(result.code === 0 || result.code === 1).toBe(true);
    });

    it('should work with custom config', async () => {
      await testEnvironment.reset(testDir);
      const customConfig = {
        extends: '@hugsy/recommended',
        permissions: {
          deny: ['Write(**/dangerous/**)'],
          allow: ['Read(**testing**)'],
        },
        env: {
          CUSTOM_VAR: 'test',
        },
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(customConfig, null, 2));

      const result = await runCommand('install');
      expect(result.code).toBe(0);

      const settings = JSON.parse(readFileSync(join(testDir, '.claude/settings.json'), 'utf-8'));
      expect(settings.permissions.deny).toContain('Write(**/dangerous/**)');
      expect(settings.env.CUSTOM_VAR).toBe('test');
    });

    it('should detect configuration changes in status command', async () => {
      // First install
      const config = { permissions: { allow: ['Read(**)'] } };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));
      
      await runCommand('install');
      
      // Wait a moment to ensure file timestamp differs
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Modify configuration
      config.permissions.allow = ['Read(**)', 'Write(**)'];
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));
      
      // Check status - should detect change
      const result = await runCommand('status');
      expect(result.stdout).toMatch(/Configuration has changed|needs? update|out of sync/i);
    });

    it('should detect partial installation', async () => {
      // Clean up any existing .claude directory first
      const claudeDir = join(testDir, '.claude');
      if (existsSync(claudeDir)) {
        rmSync(claudeDir, { recursive: true, force: true });
      }
      
      // First create a config file
      const config = { permissions: { allow: ['Read(**)'] } };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));
      
      // Create .claude directory but no settings.json (empty directory)
      mkdirSync(claudeDir, { recursive: true });
      
      const result = await runCommand('status');
      expect(result.stdout).toMatch(/partial installation|settings\.json is missing/i);
    });
  });
});
