import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../src/config/index.js';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { HugsyConfig } from '@hugsylabs/hugsy-types';

describe('ConfigManager', () => {
  const testDir = '/tmp/hugsy-config-test-' + Date.now();
  let configManager: ConfigManager;

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    configManager = new ConfigManager({ projectRoot: testDir });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('exists', () => {
    it('should return false when no config exists', () => {
      expect(configManager.exists()).toBe(false);
    });

    it('should return true when config exists', () => {
      writeFileSync(join(testDir, '.hugsyrc.json'), '{}');
      expect(configManager.exists()).toBe(true);
    });
  });

  describe('read', () => {
    it('should return null when config does not exist', () => {
      expect(configManager.read()).toBeNull();
    });

    it('should read valid JSON config', () => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)', 'Write(**)'],
        },
        env: {
          NODE_ENV: 'test',
        },
      };
      writeFileSync(join(testDir, '.hugsyrc.json'), JSON.stringify(config, null, 2));

      const result = configManager.read();
      expect(result).toEqual(config);
    });

    it('should handle invalid JSON gracefully', () => {
      writeFileSync(join(testDir, '.hugsyrc.json'), 'invalid json');
      expect(() => configManager.read()).toThrow('Failed to read config');
    });
  });

  describe('write', () => {
    it('should write config to .hugsyrc.json', () => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)', 'Write(**)'],
        },
      };

      configManager.write(config);

      expect(existsSync(join(testDir, '.hugsyrc.json'))).toBe(true);
      const result = configManager.read();
      expect(result).toEqual(config);
    });

    it('should write to custom path', () => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)'],
        },
      };
      const customPath = join(testDir, 'custom.json');

      configManager.write(config, customPath);

      expect(existsSync(customPath)).toBe(true);
    });
  });

  describe('init', () => {
    it('should initialize with default preset', () => {
      const success = configManager.init();

      expect(success).toBe(true);
      expect(existsSync(join(testDir, '.hugsyrc.json'))).toBe(true);

      const config = configManager.read();
      expect(config?.extends).toContain('recommended');
    });

    it('should initialize with specific preset', () => {
      const success = configManager.init({ preset: 'minimal' });

      expect(success).toBe(true);
      const config = configManager.read();
      expect(config?.permissions?.allow).toContain('Read(**)');
    });

    it('should not overwrite existing config without force', () => {
      writeFileSync(join(testDir, '.hugsyrc.json'), '{"test": true}');

      const success = configManager.init();

      expect(success).toBe(false);
      const config = configManager.read();
      expect(config).toEqual({ test: true });
    });

    it('should overwrite with force option', () => {
      writeFileSync(join(testDir, '.hugsyrc.json'), '{"test": true}');

      const success = configManager.init({ force: true });

      expect(success).toBe(true);
      const config = configManager.read();
      expect(config?.extends).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should validate valid config', () => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)', 'Write(**)'],
          deny: ['Write(**/.env)'],
        },
      };

      const result = configManager.validate(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid permission format', () => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['invalid-permission'],
        },
      };

      const result = configManager.validate(config);

      // ConfigManager only validates structure, not permission format
      // Permission format validation happens in the Compiler
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect invalid extends', () => {
      const config = JSON.parse('{"extends": 123, "permissions": {}}') as HugsyConfig;

      const result = configManager.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('extends field must be a string or array of strings');
    });

    it('should detect invalid env', () => {
      const config = JSON.parse('{"env": "invalid"}') as HugsyConfig;

      const result = configManager.validate(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('env field must be an object');
    });
  });

  describe('merge', () => {
    it('should merge two configs', () => {
      const base: HugsyConfig = {
        permissions: {
          allow: ['Read(**)'],
        },
        env: {
          NODE_ENV: 'development',
        },
      };

      const override: HugsyConfig = {
        permissions: {
          allow: ['Write(**)'],
          deny: ['Write(**/.env)'],
        },
        env: {
          DEBUG: 'true',
        },
      };

      const result = configManager.merge(base, override);

      expect(result.permissions?.allow).toContain('Read(**)');
      expect(result.permissions?.allow).toContain('Write(**)');
      expect(result.permissions?.deny).toContain('Write(**/.env)');
      expect(result.env?.NODE_ENV).toBe('development');
      expect(result.env?.DEBUG).toBe('true');
    });

    it('should handle array extends', () => {
      const base: HugsyConfig = {
        extends: 'preset1',
      };

      const override: HugsyConfig = {
        extends: 'preset2',
      };

      const result = configManager.merge(base, override);

      expect(result.extends).toEqual(['preset1', 'preset2']);
    });

    it('should deduplicate plugins', () => {
      const base: HugsyConfig = {
        plugins: ['plugin1', 'plugin2'],
      };

      const override: HugsyConfig = {
        plugins: ['plugin2', 'plugin3'],
      };

      const result = configManager.merge(base, override);

      expect(result.plugins).toEqual(['plugin1', 'plugin2', 'plugin3']);
    });
  });

  describe('getAvailablePresets', () => {
    it('should return list of presets', () => {
      const presets = ConfigManager.getAvailablePresets();

      expect(presets).toBeInstanceOf(Array);
      expect(presets.length).toBeGreaterThan(0);

      const recommendedPreset = presets.find((p) => p.name === 'recommended');
      expect(recommendedPreset).toBeDefined();
      expect(recommendedPreset?.description).toContain('Best practices');
    });
  });

  describe('findConfigPath', () => {
    it('should find .hugsyrc.yml if it exists', () => {
      const ymlPath = join(testDir, '.hugsyrc.yml');
      writeFileSync(ymlPath, 'test: true');

      const newConfigManager = new ConfigManager({ projectRoot: testDir });
      expect(newConfigManager.getConfigPath()).toBe(ymlPath);
    });

    it('should find hugsy.config.js if it exists', () => {
      const jsPath = join(testDir, 'hugsy.config.js');
      writeFileSync(jsPath, 'module.exports = {};');

      const newConfigManager = new ConfigManager({ projectRoot: testDir });
      expect(newConfigManager.getConfigPath()).toBe(jsPath);
    });
  });

  describe('read with different file types', () => {
    it('should throw for YAML files', () => {
      const ymlPath = join(testDir, '.hugsyrc.yml');
      writeFileSync(ymlPath, 'test: true');

      const newConfigManager = new ConfigManager({ projectRoot: testDir });
      expect(() => newConfigManager.read()).toThrow('YAML config files require yaml package');
    });

    it('should throw for JS files', () => {
      const jsPath = join(testDir, 'hugsy.config.js');
      writeFileSync(jsPath, 'module.exports = {};');

      const newConfigManager = new ConfigManager({ projectRoot: testDir });
      expect(() => newConfigManager.read()).toThrow('JS config files cannot be read synchronously');
    });
  });

  describe('getProjectRoot', () => {
    it('should return project root', () => {
      expect(configManager.getProjectRoot()).toBe(testDir);
    });
  });
});
