/**
 * Tests for package manager utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { 
  detectPackageType, 
  detectPackageManager,
  updateHugsyConfig,
  removeFromHugsyConfig
} from '../src/utils/package-manager';

describe('Package Manager Utilities', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `hugsy-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
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
      expect(detectPackageType('@hugsy-plugins/auth')).toBe('plugin');
      expect(detectPackageType('my-plugin')).toBe('plugin');
      expect(detectPackageType('@company/security-plugin')).toBe('plugin');
    });

    it('should detect preset from package name', () => {
      expect(detectPackageType('@hugsy-presets/enterprise')).toBe('preset');
      expect(detectPackageType('my-preset')).toBe('preset');
      expect(detectPackageType('@company/team-config')).toBe('preset');
    });

    it('should detect type from file extension', () => {
      expect(detectPackageType('./config.json')).toBe('preset');
      expect(detectPackageType('../presets/base.json')).toBe('preset');
      expect(detectPackageType('./plugin.js')).toBe('plugin');
      expect(detectPackageType('./plugin.mjs')).toBe('plugin');
      expect(detectPackageType('/absolute/path/plugin.ts')).toBe('plugin');
    });

    it('should respect explicit type options', () => {
      expect(detectPackageType('ambiguous-name', { plugin: true })).toBe('plugin');
      expect(detectPackageType('ambiguous-name', { preset: true })).toBe('preset');
    });

    it('should default to plugin for ambiguous names', () => {
      expect(detectPackageType('some-package')).toBe('plugin');
      expect(detectPackageType('@org/package')).toBe('plugin');
    });
  });

  describe('detectPackageManager', () => {
    it('should detect pnpm from lock file', () => {
      writeFileSync(join(testDir, 'pnpm-lock.yaml'), '');
      expect(detectPackageManager()).toBe('pnpm');
    });

    it('should detect yarn from lock file', () => {
      writeFileSync(join(testDir, 'yarn.lock'), '');
      expect(detectPackageManager()).toBe('yarn');
    });

    it('should default to npm when no lock file exists', () => {
      expect(detectPackageManager()).toBe('npm');
    });

    it('should prefer pnpm over yarn', () => {
      writeFileSync(join(testDir, 'pnpm-lock.yaml'), '');
      writeFileSync(join(testDir, 'yarn.lock'), '');
      expect(detectPackageManager()).toBe('pnpm');
    });
  });

  describe('updateHugsyConfig', () => {
    beforeEach(() => {
      // Create a basic .hugsyrc.json
      const config = {
        env: { NODE_ENV: 'development' }
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));
    });

    it('should add plugin to configuration', () => {
      const result = updateHugsyConfig('@hugsy-plugins/auth', 'plugin');
      expect(result).toBe(true);

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(config.plugins).toEqual(['@hugsy-plugins/auth']);
    });

    it('should add preset to configuration', () => {
      const result =  updateHugsyConfig('@hugsy-presets/enterprise', 'preset');
      expect(result).toBe(true);

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(config.extends).toEqual(['@hugsy-presets/enterprise']);
    });

    it('should not duplicate plugins', () => {
       updateHugsyConfig('@hugsy-plugins/auth', 'plugin');
       updateHugsyConfig('@hugsy-plugins/auth', 'plugin');

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(config.plugins).toEqual(['@hugsy-plugins/auth']);
    });

    it('should not duplicate presets', () => {
       updateHugsyConfig('@hugsy-presets/enterprise', 'preset');
       updateHugsyConfig('@hugsy-presets/enterprise', 'preset');

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(config.extends).toEqual(['@hugsy-presets/enterprise']);
    });

    it('should convert string extends to array when adding preset', () => {
      const config = {
        extends: '@hugsy/recommended'
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));

       updateHugsyConfig('@hugsy-presets/enterprise', 'preset');

      const updatedConfig = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(updatedConfig.extends).toEqual(['@hugsy/recommended', '@hugsy-presets/enterprise']);
    });

    it('should return false if config does not exist', () => {
      rmSync(join(testDir, '.hugsyrc.json'));
      const result =  updateHugsyConfig('@hugsy-plugins/auth', 'plugin');
      expect(result).toBe(false);
    });
  });

  describe('removeFromHugsyConfig', () => {
    beforeEach(() => {
      // Create a config with plugins and presets
      const config = {
        env: { NODE_ENV: 'development' },
        plugins: ['@hugsy-plugins/auth', '@hugsy-plugins/security'],
        extends: ['@hugsy-presets/base', '@hugsy-presets/enterprise']
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));
    });

    it('should remove plugin from configuration', () => {
      const result =  removeFromHugsyConfig('@hugsy-plugins/auth');
      expect(result).toBe(true);

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(config.plugins).toEqual(['@hugsy-plugins/security']);
    });

    it('should remove preset from configuration', () => {
      const result =  removeFromHugsyConfig('@hugsy-presets/enterprise');
      expect(result).toBe(true);

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      // When only one preset remains, it's converted to a string
      expect(config.extends).toBe('@hugsy-presets/base');
    });

    it('should remove plugins field when empty', () => {
       removeFromHugsyConfig('@hugsy-plugins/auth');
       removeFromHugsyConfig('@hugsy-plugins/security');

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(config.plugins).toBeUndefined();
    });

    it('should convert extends array to string when only one item remains', () => {
       removeFromHugsyConfig('@hugsy-presets/enterprise');

      const config = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(config.extends).toBe('@hugsy-presets/base');
    });

    it('should handle string extends field', () => {
      const config = {
        extends: '@hugsy-presets/base'
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));

      const result =  removeFromHugsyConfig('@hugsy-presets/base');
      expect(result).toBe(true);

      const updatedConfig = JSON.parse(readFileSync(join(testDir, '.hugsyrc.json'), 'utf8'));
      expect(updatedConfig.extends).toBeUndefined();
    });

    it('should return false if package not found', () => {
      const result =  removeFromHugsyConfig('@hugsy-plugins/non-existent');
      expect(result).toBe(false);
    });

    it('should return false if config does not exist', () => {
      rmSync(join(testDir, '.hugsyrc.json'));
      const result =  removeFromHugsyConfig('@hugsy-plugins/auth');
      expect(result).toBe(false);
    });
  });
});