import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PackageManager } from '../src/packages/index.js';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import type { HugsyConfig } from '@hugsylabs/hugsy-types';

describe('PackageManager', () => {
  const testDir = '/tmp/hugsy-packages-test-' + Date.now();
  let packageManager: PackageManager;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    packageManager = new PackageManager(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('detectPackageType', () => {
    it('should detect plugin by name pattern', () => {
      expect(packageManager.detectPackageType('@hugsy/plugin-test')).toBe('plugin');
      expect(packageManager.detectPackageType('@hugsylabs/plugin-auth')).toBe('plugin');
      expect(packageManager.detectPackageType('hugsy-plugin-custom')).toBe('plugin');
    });

    it('should detect preset by name pattern', () => {
      expect(packageManager.detectPackageType('@hugsy/preset-recommended')).toBe('preset');
      expect(packageManager.detectPackageType('@hugsylabs/preset-security')).toBe('preset');
      expect(packageManager.detectPackageType('hugsy-preset-custom')).toBe('preset');
    });

    it('should detect by explicit option', () => {
      expect(packageManager.detectPackageType('my-package', { plugin: true })).toBe('plugin');
      expect(packageManager.detectPackageType('my-package', { preset: true })).toBe('preset');
    });

    it('should default to plugin for unknown packages', () => {
      expect(packageManager.detectPackageType('unknown-package')).toBe('plugin');
    });
  });

  describe('addToConfig', () => {
    beforeEach(() => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)'],
        },
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));
    });

    it('should add plugin to config', () => {
      const result = packageManager.addToConfig('@hugsy/plugin-test', 'plugin');

      expect(result).toBe(true);
      const config = JSON.parse(
        readFileSync(join(testDir, '.hugsyrc.json'), 'utf-8')
      ) as HugsyConfig;
      expect(config.plugins).toContain('@hugsy/plugin-test');
    });

    it('should add preset to config', () => {
      const result = packageManager.addToConfig('@hugsy/preset-custom', 'preset');

      expect(result).toBe(true);
      const config = JSON.parse(
        readFileSync(join(testDir, '.hugsyrc.json'), 'utf-8')
      ) as HugsyConfig;
      // When adding to empty extends, it creates an array
      expect(config.extends).toEqual(['@hugsy/preset-custom']);
    });

    it('should convert string extends to array when adding preset', () => {
      const config: HugsyConfig = {
        extends: '@hugsy/preset-base',
        permissions: {},
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));

      packageManager.addToConfig('@hugsy/preset-extra', 'preset');

      const updatedConfig = JSON.parse(
        readFileSync(join(testDir, '.hugsyrc.json'), 'utf-8')
      ) as HugsyConfig;
      expect(updatedConfig.extends).toEqual(['@hugsy/preset-base', '@hugsy/preset-extra']);
    });

    it('should not add duplicate plugin', () => {
      const config: HugsyConfig = {
        plugins: ['@hugsy/plugin-test'],
        permissions: {},
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));

      const result = packageManager.addToConfig('@hugsy/plugin-test', 'plugin');

      expect(result).toBe(false);
    });

    it('should throw if config does not exist', () => {
      rmSync(join(testDir, '.hugsyrc.json'));
      expect(() => packageManager.addToConfig('@hugsy/plugin-test', 'plugin')).toThrow(
        'No .hugsyrc.json found'
      );
    });
  });

  describe('removeFromConfig', () => {
    it('should remove plugin from config', () => {
      const config: HugsyConfig = {
        plugins: ['@hugsy/plugin-test', '@hugsy/plugin-auth'],
        permissions: {},
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));

      const result = packageManager.removeFromConfig('@hugsy/plugin-test');

      expect(result).toBe(true);
      const updatedConfig = JSON.parse(
        readFileSync(join(testDir, '.hugsyrc.json'), 'utf-8')
      ) as HugsyConfig;
      expect(updatedConfig.plugins).toEqual(['@hugsy/plugin-auth']);
    });

    it('should remove preset from config', () => {
      const config: HugsyConfig = {
        extends: ['@hugsy/preset-base', '@hugsy/preset-custom'],
        permissions: {},
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));

      const result = packageManager.removeFromConfig('@hugsy/preset-custom');

      expect(result).toBe(true);
      const updatedConfig = JSON.parse(
        readFileSync(join(testDir, '.hugsyrc.json'), 'utf-8')
      ) as HugsyConfig;
      expect(updatedConfig.extends).toBe('@hugsy/preset-base');
    });

    it('should remove plugins field when empty', () => {
      const config: HugsyConfig = {
        plugins: ['@hugsy/plugin-test'],
        permissions: {},
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));

      packageManager.removeFromConfig('@hugsy/plugin-test');

      const updatedConfig = JSON.parse(
        readFileSync(join(testDir, '.hugsyrc.json'), 'utf-8')
      ) as HugsyConfig;
      expect(updatedConfig.plugins).toBeUndefined();
    });

    it('should return false if package not found', () => {
      const config: HugsyConfig = {
        plugins: ['@hugsy/plugin-test'],
        permissions: {},
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));

      const result = packageManager.removeFromConfig('@hugsy/plugin-nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getPackageInfo', () => {
    it('should return info for non-installed package', () => {
      const info = packageManager.getPackageInfo('@hugsy/plugin-test');

      expect(info).toBeDefined();
      expect(info?.name).toBe('@hugsy/plugin-test');
      expect(info?.type).toBe('plugin');
      expect(info?.installed).toBe(false);
    });

    it('should return info for installed package', () => {
      // Simulate installed package
      const nodeModulesPath = join(testDir, 'node_modules', '@hugsy', 'plugin-test');
      mkdirSync(nodeModulesPath, { recursive: true });
      writeFileSync(
        join(nodeModulesPath, 'package.json'),
        JSON.stringify({
          name: '@hugsy/plugin-test',
          version: '1.0.0',
          description: 'Test plugin',
        })
      );

      const info = packageManager.getPackageInfo('@hugsy/plugin-test');

      expect(info).toBeDefined();
      expect(info?.name).toBe('@hugsy/plugin-test');
      expect(info?.version).toBe('1.0.0');
      expect(info?.description).toBe('Test plugin');
      expect(info?.installed).toBe(true);
    });

    it('should handle invalid package gracefully', () => {
      // Create invalid package.json
      const nodeModulesPath = join(testDir, 'node_modules', 'invalid-package');
      mkdirSync(nodeModulesPath, { recursive: true });
      writeFileSync(join(nodeModulesPath, 'package.json'), 'invalid json');

      const info = packageManager.getPackageInfo('invalid-package');
      expect(info).toBeNull();
    });
  });

  describe('discoverPackages', () => {
    it('should return empty array if no package.json', () => {
      const packages = packageManager.discoverPackages();
      expect(packages).toEqual([]);
    });

    it('should return empty array if no node_modules', () => {
      // Create project package.json but no node_modules
      const packageJson = {
        dependencies: {
          '@hugsylabs/plugin-auth': '^1.0.0',
        },
      };
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson));

      const packages = packageManager.discoverPackages();
      expect(packages).toEqual([]);
    });

    it('should discover Hugsy packages from package.json', () => {
      // Create project package.json
      const packageJson = {
        dependencies: {
          '@hugsylabs/plugin-auth': '^1.0.0',
          '@hugsy/preset-recommended': '^2.0.0',
          'other-package': '^1.0.0',
        },
        devDependencies: {
          'hugsy-plugin-test': '^0.1.0',
        },
      };
      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson));

      // Create node_modules for the Hugsy packages
      const nodeModulesPath = join(testDir, 'node_modules');
      mkdirSync(join(nodeModulesPath, '@hugsylabs', 'plugin-auth'), { recursive: true });
      writeFileSync(
        join(nodeModulesPath, '@hugsylabs', 'plugin-auth', 'package.json'),
        JSON.stringify({ name: '@hugsylabs/plugin-auth', version: '1.0.0' })
      );

      mkdirSync(join(nodeModulesPath, '@hugsy', 'preset-recommended'), { recursive: true });
      writeFileSync(
        join(nodeModulesPath, '@hugsy', 'preset-recommended', 'package.json'),
        JSON.stringify({ name: '@hugsy/preset-recommended', version: '2.0.0' })
      );

      mkdirSync(join(nodeModulesPath, 'hugsy-plugin-test'), { recursive: true });
      writeFileSync(
        join(nodeModulesPath, 'hugsy-plugin-test', 'package.json'),
        JSON.stringify({ name: 'hugsy-plugin-test', version: '0.1.0' })
      );

      const packages = packageManager.discoverPackages();

      expect(packages).toBeInstanceOf(Array);
      expect(packages.length).toBe(3);

      const authPlugin = packages.find((p) => p.name === '@hugsylabs/plugin-auth');
      expect(authPlugin).toBeDefined();
      expect(authPlugin?.type).toBe('plugin');
      expect(authPlugin?.installed).toBe(true);

      const preset = packages.find((p) => p.name === '@hugsy/preset-recommended');
      expect(preset).toBeDefined();
      expect(preset?.type).toBe('preset');
    });

    it('should handle package.json read errors gracefully', () => {
      // Create invalid package.json
      writeFileSync(join(testDir, 'package.json'), 'invalid json');

      const packages = packageManager.discoverPackages();
      expect(packages).toEqual([]);
    });
  });

  describe('isLocalPackage', () => {
    it('should identify local packages', () => {
      expect(packageManager.isLocalPackage('./local-plugin')).toBe(true);
      expect(packageManager.isLocalPackage('../relative-plugin')).toBe(true);
      expect(packageManager.isLocalPackage('/absolute/path/plugin')).toBe(true);
    });

    it('should identify npm packages', () => {
      expect(packageManager.isLocalPackage('@hugsy/plugin-test')).toBe(false);
      expect(packageManager.isLocalPackage('hugsy-plugin-test')).toBe(false);
    });
  });

  describe('validatePackage', () => {
    it('should validate local package that exists', () => {
      writeFileSync(join(testDir, 'local-plugin.js'), 'module.exports = {}');

      const result = packageManager.validatePackage('./local-plugin.js');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should invalidate local package that does not exist', () => {
      const result = packageManager.validatePackage('./non-existent.js');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should validate installed npm package', () => {
      const nodeModulesPath = join(testDir, 'node_modules', 'test-package');
      mkdirSync(nodeModulesPath, { recursive: true });
      writeFileSync(join(nodeModulesPath, 'package.json'), '{}');

      const result = packageManager.validatePackage('test-package');
      expect(result.valid).toBe(true);
    });

    it('should invalidate non-installed npm package', () => {
      const result = packageManager.validatePackage('non-installed-package');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not installed');
    });
  });
});
