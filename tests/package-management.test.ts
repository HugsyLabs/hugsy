/**
 * Integration tests for package management features
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
const TEST_DIR = '/tmp/hugsy-package-test-' + Date.now();

interface TestResult {
  stdout: string;
  stderr: string;
  code: number;
}

function runCommand(command: string, args: string[] = []): Promise<TestResult> {
  return new Promise<TestResult>((resolve) => {
    const proc = spawn('node', [CLI_PATH, command, ...args], {
      cwd: TEST_DIR,
      env: { ...process.env, NODE_ENV: 'test', NO_COLOR: '1' },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => (stdout += data.toString()));
    proc.stderr.on('data', (data) => (stderr += data.toString()));

    proc.on('close', (code: number | null) => {
      resolve({ code: code || 0, stdout, stderr });
    });
  });
}

describe('Package Management Integration Tests', () => {
  beforeAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('init with automatic installation', () => {
    it('should initialize and install configuration automatically', async () => {
      const result = await runCommand('init', ['recommended']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Created .hugsyrc.json');
      expect(result.stdout).toContain('Created .claude directory');
      expect(result.stdout).toContain('Created .claude/settings.json');
      expect(result.stdout).toContain('Hugsy initialized and installed successfully!');
      
      // Verify files were created
      expect(existsSync(join(TEST_DIR, '.hugsyrc.json'))).toBe(true);
      expect(existsSync(join(TEST_DIR, '.claude/settings.json'))).toBe(true);
    });

    it('should skip installation with --no-install flag', async () => {
      // Clean up first
      rmSync(join(TEST_DIR, '.hugsyrc.json'), { force: true });
      rmSync(join(TEST_DIR, '.claude'), { recursive: true, force: true });
      
      const result = await runCommand('init', ['recommended', '--no-install']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Created .hugsyrc.json');
      expect(result.stdout).not.toContain('Created .claude directory');
      expect(result.stdout).toContain('Run hugsy install to compile and activate');
      
      // Verify only config was created
      expect(existsSync(join(TEST_DIR, '.hugsyrc.json'))).toBe(true);
      expect(existsSync(join(TEST_DIR, '.claude/settings.json'))).toBe(false);
    });
  });

  describe('install packages', () => {
    beforeAll(async () => {
      // Ensure we have a fresh config
      rmSync(join(TEST_DIR, '.hugsyrc.json'), { force: true });
      rmSync(join(TEST_DIR, '.claude'), { recursive: true, force: true });
      await runCommand('init', ['recommended']);
    });

    it('should add local plugin to configuration', async () => {
      // Create a test plugin
      const pluginPath = join(TEST_DIR, 'test-plugin.mjs');
      const pluginContent = `
export default {
  name: 'test-plugin',
  transform(config) {
    config.env = config.env || {};
    config.env.TEST_PLUGIN = 'loaded';
    return config;
  }
}`;
      writeFileSync(pluginPath, pluginContent);
      
      const result = await runCommand('install', ['./test-plugin.mjs', '--force']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Processing ./test-plugin.mjs as plugin');
      expect(result.stdout).toContain('Added plugin to configuration');
      
      // Verify config was updated
      const config = JSON.parse(readFileSync(join(TEST_DIR, '.hugsyrc.json'), 'utf8'));
      expect(config.plugins).toContain('./test-plugin.mjs');
    });

    it('should add local preset to configuration', async () => {
      // Create a test preset
      const presetPath = join(TEST_DIR, 'test-preset.json');
      const presetContent = JSON.stringify({
        env: {
          PRESET_VAR: 'from_preset'
        },
        permissions: {
          allow: ['Read(**/*.md)']
        }
      }, null, 2);
      writeFileSync(presetPath, presetContent);
      
      const result = await runCommand('install', ['./test-preset.json', '--force']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Processing ./test-preset.json as preset');
      expect(result.stdout).toContain('Added preset to configuration');
      
      // Verify config was updated
      const config = JSON.parse(readFileSync(join(TEST_DIR, '.hugsyrc.json'), 'utf8'));
      expect(Array.isArray(config.extends) ? config.extends : [config.extends])
        .toContain('./test-preset.json');
    });

    it('should handle multiple packages in one command', async () => {
      // Create another plugin
      const plugin2Path = join(TEST_DIR, 'another-plugin.mjs');
      const plugin2Content = `
export default {
  name: 'another-plugin',
  transform(config) {
    return config;
  }
}`;
      writeFileSync(plugin2Path, plugin2Content);
      
      const result = await runCommand('install', [
        './another-plugin.mjs',
        '--force'
      ]);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Processing ./another-plugin.mjs as plugin');
      
      const config = JSON.parse(readFileSync(join(TEST_DIR, '.hugsyrc.json'), 'utf8'));
      expect(config.plugins).toContain('./another-plugin.mjs');
    });

    it('should detect duplicate packages', async () => {
      const result = await runCommand('install', ['./test-plugin.mjs', '--force']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('already in configuration');
    });
  });

  describe('uninstall packages', () => {
    it('should remove plugin from configuration', async () => {
      const result = await runCommand('uninstall', ['./test-plugin.mjs']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Removing ./test-plugin.mjs from configuration');
      expect(result.stdout).toContain('Removed plugin from configuration');
      
      // Verify config was updated
      const config = JSON.parse(readFileSync(join(TEST_DIR, '.hugsyrc.json'), 'utf8'));
      expect(config.plugins).not.toContain('./test-plugin.mjs');
    });

    it('should remove preset from configuration', async () => {
      const result = await runCommand('uninstall', ['./test-preset.json']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Removing ./test-preset.json from configuration');
      expect(result.stdout).toContain('Removed preset from configuration');
      
      // Verify config was updated
      const config = JSON.parse(readFileSync(join(TEST_DIR, '.hugsyrc.json'), 'utf8'));
      const extends_ = Array.isArray(config.extends) ? config.extends : [config.extends];
      expect(extends_).not.toContain('./test-preset.json');
    });

    it('should handle non-existent packages gracefully', async () => {
      const result = await runCommand('uninstall', ['./non-existent.js']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('not found in configuration');
    });

    it('should uninstall multiple packages', async () => {
      // First add them back
      await runCommand('install', ['./test-plugin.mjs', './another-plugin.mjs', '--force']);
      
      const result = await runCommand('uninstall', ['./test-plugin.mjs', './another-plugin.mjs']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Configuration updated successfully');
      
      const config = JSON.parse(readFileSync(join(TEST_DIR, '.hugsyrc.json'), 'utf8'));
      expect(config.plugins || []).not.toContain('./test-plugin.mjs');
      expect(config.plugins || []).not.toContain('./another-plugin.mjs');
    });
  });

  describe('uninstall hugsy entirely', () => {
    it('should uninstall hugsy when no packages provided', async () => {
      const result = await runCommand('uninstall', ['--yes']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Uninstalling Hugsy');
      expect(result.stdout).toContain('Removed .hugsyrc.json');
      
      // Verify config was removed
      expect(existsSync(join(TEST_DIR, '.hugsyrc.json'))).toBe(false);
    });
  });
});