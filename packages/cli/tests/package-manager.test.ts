/**
 * Tests for package manager utilities (now using core PackageManager)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PackageManager } from '@hugsylabs/hugsy-core';

describe('Package Manager Utilities', () => {
  let testDir: string;
  let packageManager: PackageManager;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `hugsy-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
    packageManager = new PackageManager(testDir);
  });

  afterEach(() => {
    // Clean up
    process.chdir('/');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('detectPackageType', () => {
    it('should detect plugin from package name', () => {
      expect(packageManager.detectPackageType('@hugsy-plugins/auth')).toBe('plugin');
      expect(packageManager.detectPackageType('my-plugin')).toBe('plugin');
      expect(packageManager.detectPackageType('@company/security-plugin')).toBe('plugin');
    });

    it('should detect preset from package name', () => {
      expect(packageManager.detectPackageType('@hugsy-presets/enterprise')).toBe('preset');
      expect(packageManager.detectPackageType('my-preset')).toBe('preset');
      expect(packageManager.detectPackageType('@company/team-config')).toBe('preset');
    });

    it('should detect type from file extension', () => {
      expect(packageManager.detectPackageType('./config.json')).toBe('preset');
      expect(packageManager.detectPackageType('../presets/base.json')).toBe('preset');
      expect(packageManager.detectPackageType('./plugin.js')).toBe('plugin');
      expect(packageManager.detectPackageType('./plugin.mjs')).toBe('plugin');
      expect(packageManager.detectPackageType('/absolute/path/plugin.ts')).toBe('plugin');
    });

    it('should respect explicit type options', () => {
      expect(packageManager.detectPackageType('ambiguous-name', { plugin: true })).toBe('plugin');
      expect(packageManager.detectPackageType('ambiguous-name', { preset: true })).toBe('preset');
    });

    it('should default to plugin for ambiguous names', () => {
      expect(packageManager.detectPackageType('some-package')).toBe('plugin');
      expect(packageManager.detectPackageType('@org/package')).toBe('plugin');
    });
  });

  describe('detectPackageManager', () => {
    it('should detect pnpm from lock file', () => {
      writeFileSync(join(testDir, 'pnpm-lock.yaml'), '');
      expect(packageManager.detectPackageManager()).toBe('pnpm');
    });

    it('should detect yarn from lock file', () => {
      writeFileSync(join(testDir, 'yarn.lock'), '');
      expect(packageManager.detectPackageManager()).toBe('yarn');
    });

    it('should default to npm when no lock file exists', () => {
      expect(packageManager.detectPackageManager()).toBe('npm');
    });

    it('should prefer pnpm over yarn', () => {
      writeFileSync(join(testDir, 'pnpm-lock.yaml'), '');
      writeFileSync(join(testDir, 'yarn.lock'), '');
      expect(packageManager.detectPackageManager()).toBe('pnpm');
    });
  });

  describe('updateHugsyConfig', () => {
    beforeEach(() => {
      // Create a basic .hugsyrc.json
      const config = {
        env: { NODE_ENV: 'development' },
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));
    });

    it('should add plugin to configuration', () => {
      const result = packageManager.addToConfig('@hugsy-plugins/auth', 'plugin');
      expect(result).toBe(true);

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(config.plugins).toEqual(['@hugsy-plugins/auth']);
    });

    it('should add preset to configuration', () => {
      const result = packageManager.addToConfig('@hugsy-presets/enterprise', 'preset');
      expect(result).toBe(true);

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(config.extends).toEqual(['@hugsy-presets/enterprise']);
    });

    it('should not duplicate plugins', () => {
      packageManager.addToConfig('@hugsy-plugins/auth', 'plugin');
      packageManager.addToConfig('@hugsy-plugins/auth', 'plugin');

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(config.plugins).toEqual(['@hugsy-plugins/auth']);
    });

    it('should not duplicate presets', () => {
      packageManager.addToConfig('@hugsy-presets/enterprise', 'preset');
      packageManager.addToConfig('@hugsy-presets/enterprise', 'preset');

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(config.extends).toEqual(['@hugsy-presets/enterprise']);
    });

    it('should convert string extends to array when adding preset', () => {
      const config = {
        extends: '@hugsy/recommended',
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));

      packageManager.addToConfig('@hugsy-presets/enterprise', 'preset');

      const updatedConfig = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(updatedConfig.extends).toEqual(['@hugsy/recommended', '@hugsy-presets/enterprise']);
    });

    it('should return false if config does not exist', () => {
      rmSync(join(testDir, '.hugsyrc.json'));
      const result = packageManager.addToConfig('@hugsy-plugins/auth', 'plugin');
      expect(result).toBe(false);
    });
  });

  describe('removeFromHugsyConfig', () => {
    beforeEach(() => {
      // Create a config with plugins and presets
      const config = {
        env: { NODE_ENV: 'development' },
        plugins: ['@hugsy-plugins/auth', '@hugsy-plugins/security'],
        extends: ['@hugsy-presets/base', '@hugsy-presets/enterprise'],
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));
    });

    it('should remove plugin from configuration', () => {
      const result = packageManager.removeFromConfig('@hugsy-plugins/auth');
      expect(result).toBe(true);

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(config.plugins).toEqual(['@hugsy-plugins/security']);
    });

    it('should remove preset from configuration', () => {
      const result = packageManager.removeFromConfig('@hugsy-presets/enterprise');
      expect(result).toBe(true);

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      // When only one preset remains, it's converted to a string
      expect(config.extends).toBe('@hugsy-presets/base');
    });

    it('should remove plugins field when empty', () => {
      packageManager.removeFromConfig('@hugsy-plugins/auth');
      packageManager.removeFromConfig('@hugsy-plugins/security');

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(config.plugins).toBeUndefined();
    });

    it('should convert extends array to string when only one item remains', () => {
      packageManager.removeFromConfig('@hugsy-presets/enterprise');

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(config.extends).toBe('@hugsy-presets/base');
    });

    it('should handle string extends field', () => {
      const config = {
        extends: '@hugsy-presets/base',
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));

      const result = packageManager.removeFromConfig('@hugsy-presets/base');
      expect(result).toBe(true);

      const updatedConfig = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(updatedConfig.extends).toBeUndefined();
    });

    it('should return false if package not found', () => {
      const result = packageManager.removeFromConfig('@hugsy-plugins/non-existent');
      expect(result).toBe(false);
    });

    it('should return false if config does not exist', () => {
      rmSync(join(testDir, '.hugsyrc.json'));
      const result = packageManager.removeFromConfig('@hugsy-plugins/auth');
      expect(result).toBe(false);
    });
  });
});
