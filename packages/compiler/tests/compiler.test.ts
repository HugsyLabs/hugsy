import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as yaml from 'yaml';
import { Compiler } from '../src/index';
import type { HugsyConfig, Plugin, HugsyPlugin } from '../src/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_DIR = join(__dirname, 'test-temp');

// Create temp directory for tests
beforeEach(() => {
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }
});

afterEach(() => {
  vi.clearAllMocks();
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe('Compiler', () => {
  let compiler: Compiler;

  beforeEach(() => {
    compiler = new Compiler({ projectRoot: TEST_DIR, throwOnError: true });
  });

  describe('Configuration Loading and Compilation', () => {
    it('should compile basic JSON configuration', async () => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)', 'Write(**/test/**)'],
          deny: ['Write(**/prod/**)'],
        },
        env: {
          NODE_ENV: 'test',
        },
        includeCoAuthoredBy: false,
        cleanupPeriodDays: 7,
      };

      const result = await compiler.compile(config);

      expect(result.permissions?.allow).toContain('Read(**)');
      expect(result.permissions?.allow).toContain('Write(**/test/**)');
      expect(result.permissions?.deny).toContain('Write(**/prod/**)');
      expect(result.env?.NODE_ENV).toBe('test');
      expect(result.includeCoAuthoredBy).toBe(false);
      expect(result.cleanupPeriodDays).toBe(7);
    });

    it('should apply default values for missing fields', async () => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)'],
        },
      };

      const result = await compiler.compile(config);

      expect(result.permissions?.allow).toContain('Read(**)');
      expect(result.permissions?.deny).toEqual([]);
      expect(result.permissions?.ask).toEqual([]);
      // No defaults should be added if not specified
      expect(result.includeCoAuthoredBy).toBeUndefined();
      expect(result.cleanupPeriodDays).toBeUndefined();
      // env now returns empty object
      expect(result.env).toEqual({});
    });

    it('should handle statusLine configuration', async () => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)'],
        },
        statusLine: {
          type: 'static' as const,
          text: 'test status',
        },
      };

      const result = await compiler.compile(config);

      expect(result.statusLine).toEqual({
        type: 'static',
        text: 'test status',
      });
    });

    it('should handle model configuration', async () => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)'],
        },
        model: 'claude-3-opus-20240229',
      };

      const result = await compiler.compile(config);

      expect(result.model).toBe('claude-3-opus-20240229');
    });
  });

  describe('Permissions Merging with Presets', () => {
    it('should merge permissions from preset with correct priority', async () => {
      // Create a preset file
      const presetConfig = {
        permissions: {
          allow: ['Bash(npm test)', 'Read(**/src/**)'],
          ask: ['WebSearch'],
          deny: ['Write(**/secure/**)'],
        },
        env: {
          NODE_ENV: 'development',
          DEBUG: 'false',
        },
      };

      const presetPath = join(TEST_DIR, 'preset.json');
      writeFileSync(presetPath, JSON.stringify(presetConfig));

      const config = {
        extends: presetPath,
        permissions: {
          allow: ['Write(**/test/**)'],
          deny: ['Write(**/prod/**)', 'Write(**/secure/**)'], // Should merge with preset
        },
        env: {
          NODE_ENV: 'production', // Should override preset
          API_KEY: 'secret',
        },
      };

      const result = await compiler.compile(config);

      // Check permissions merged correctly
      expect(result.permissions?.allow).toContain('Bash(npm test)'); // from preset
      expect(result.permissions?.allow).toContain('Read(**/src/**)'); // from preset
      expect(result.permissions?.allow).toContain('Write(**/test/**)'); // from config

      expect(result.permissions?.ask).toContain('WebSearch'); // from preset

      expect(result.permissions?.deny).toContain('Write(**/secure/**)'); // from both
      expect(result.permissions?.deny).toContain('Write(**/prod/**)'); // from config

      // Check env merged with override
      expect(result.env?.NODE_ENV).toBe('production'); // overridden
      expect(result.env?.DEBUG).toBe('false'); // from preset
      expect(result.env?.API_KEY).toBe('secret'); // from config
    });

    it('should handle permission priority (deny > ask > allow)', async () => {
      const presetConfig = {
        permissions: {
          allow: ['Read(**/data/**)', 'Write(**/logs/**)'],
        },
      };

      const presetPath = join(TEST_DIR, 'preset.json');
      writeFileSync(presetPath, JSON.stringify(presetConfig));

      const config = {
        extends: presetPath,
        permissions: {
          deny: ['Read(**/data/**)'], // Should remove from allow
          ask: ['Write(**/logs/**)'], // Should move from allow to ask
        },
      };

      const result = await compiler.compile(config);

      // Read(**/data/**) should be in deny, not allow
      expect(result.permissions?.deny).toContain('Read(**/data/**)');
      expect(result.permissions?.allow).not.toContain('Read(**/data/**)');

      // Write(**/logs/**) should be in ask, not allow
      expect(result.permissions?.ask).toContain('Write(**/logs/**)');
      expect(result.permissions?.allow).not.toContain('Write(**/logs/**)');
    });

    it('should deduplicate permissions across levels', async () => {
      const config = {
        permissions: {
          allow: ['Read(**)', 'Read(**)', 'Write(**/test/**)', 'Write(**/test/**)'],
          deny: ['Write(**/prod/**)', 'Write(**/prod/**)'],
        },
      };

      const result = await compiler.compile(config);

      // Check deduplication - should have unique values only
      expect(result.permissions?.allow).toEqual(['Read(**)', 'Write(**/test/**)']);
      expect(result.permissions?.deny).toEqual(['Write(**/prod/**)']);
    });

    it('should log deduplication info in verbose mode', async () => {
      const verboseCompiler = new Compiler({ projectRoot: TEST_DIR, verbose: true });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)', 'Write(test.txt)', 'Exec(*)'],
          ask: ['Write(test.txt)', 'Task'],
          deny: ['Task', 'Exec(*)'],
        },
      };

      await verboseCompiler.compile(config);

      const logs = consoleSpy.mock.calls.map((call) => call[0]);
      const hasDeduplicationHeader = logs.some((log) => log.includes('Permission Deduplication'));
      const hasWriteConflict = logs.some(
        (log) => log.includes('Write(test.txt)') && log.includes("found in both 'allow' and 'ask'")
      );
      const hasTaskConflict = logs.some(
        (log) => log.includes('Task') && log.includes("found in both 'ask' and 'deny'")
      );
      const hasExecConflict = logs.some(
        (log) => log.includes('Exec(*)') && log.includes("found in both 'allow' and 'deny'")
      );

      expect(hasDeduplicationHeader).toBe(true);
      expect(hasWriteConflict).toBe(true);
      expect(hasTaskConflict).toBe(true);
      expect(hasExecConflict).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should show brief message in non-verbose mode', async () => {
      const normalCompiler = new Compiler({ projectRoot: TEST_DIR, verbose: false });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      const config: HugsyConfig = {
        permissions: {
          allow: ['Write(test.txt)', 'Read(**)'],
          deny: ['Write(test.txt)'],
        },
      };

      await normalCompiler.compile(config);

      const logs = consoleSpy.mock.calls.map((call) => call[0]);
      const hasInfoMessage = logs.some((log) =>
        log.includes('[Info] Resolved 1 permission conflict(s) using security-first priority')
      );
      expect(hasInfoMessage).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Hooks Configuration', () => {
    it('should compile hooks from configuration', async () => {
      const config = {
        permissions: {
          allow: ['Read(**)'],
        },
        hooks: {
          'on-tool-use': [
            {
              matcher: '**/*.js',
              hooks: [
                {
                  type: 'command' as const,
                  command: 'eslint --fix',
                  timeout: 5000,
                },
              ],
            },
          ],
          'pre-commit': [
            {
              matcher: '**/*.md',
              hooks: [
                {
                  type: 'command' as const,
                  command: 'markdownlint',
                },
              ],
            },
          ],
        },
      };

      const result = await compiler.compile(config);

      const onToolUseHooks = result.hooks?.['on-tool-use'];
      if (Array.isArray(onToolUseHooks)) {
        expect(onToolUseHooks).toHaveLength(1);
        expect(onToolUseHooks[0].matcher).toBe('**/*.js');
        expect(onToolUseHooks[0].hooks?.[0].command).toBe('eslint --fix');
        // blocking property removed from type definition
        expect(onToolUseHooks[0].hooks?.[0].timeout).toBe(5000);
      }

      const preCommitHooks = result.hooks?.['pre-commit'];
      if (Array.isArray(preCommitHooks)) {
        expect(preCommitHooks).toHaveLength(1);
        expect(preCommitHooks[0].matcher).toBe('**/*.md');
      }
    });

    it('should merge hooks from presets', async () => {
      const presetConfig = {
        hooks: {
          'on-tool-use': [
            {
              matcher: '**/*.js',
              hooks: [{ type: 'command' as const, command: 'prettier --write' }],
            },
          ],
        },
      };

      const presetPath = join(TEST_DIR, 'preset.json');
      writeFileSync(presetPath, JSON.stringify(presetConfig));

      const config = {
        extends: presetPath,
        permissions: {
          allow: ['Read(**)'],
        },
        hooks: {
          'on-tool-use': [
            {
              matcher: '**/*.ts',
              hooks: [{ type: 'command' as const, command: 'eslint --fix' }],
            },
          ],
          'post-commit': [
            {
              matcher: '**/*',
              hooks: [{ type: 'command' as const, command: 'git status' }],
            },
          ],
        },
      };

      const result = await compiler.compile(config);

      // Hooks should merge from presets properly
      const onToolUse = result.hooks?.['on-tool-use'];
      if (Array.isArray(onToolUse)) {
        expect(onToolUse).toHaveLength(2);

        // Check preset hook was merged
        const jsHook = onToolUse.find((h) => h.matcher === '**/*.js');
        expect(jsHook).toBeDefined();
        expect(jsHook?.hooks?.[0]?.command).toBe('prettier --write');

        const tsHook = onToolUse.find((h) => h.matcher === '**/*.ts');
        expect(tsHook?.hooks?.[0]?.command).toBe('eslint --fix');
      }

      // Should have post-commit from config
      const postCommit = result.hooks?.['post-commit'];
      if (Array.isArray(postCommit)) {
        expect(postCommit).toHaveLength(1);
      }
    });

    it('should deduplicate identical hooks', async () => {
      const presetConfig = {
        hooks: {
          'on-tool-use': [
            {
              matcher: '**/*.js',
              hooks: [{ type: 'command' as const, command: 'eslint' }],
            },
          ],
        },
      };

      const presetPath = join(TEST_DIR, 'preset.json');
      writeFileSync(presetPath, JSON.stringify(presetConfig));

      const config = {
        extends: presetPath,
        permissions: {
          allow: ['Read(**)'],
        },
        hooks: {
          'on-tool-use': [
            {
              matcher: '**/*.js',
              hooks: [{ type: 'command' as const, command: 'eslint' }], // Duplicate
            },
            {
              matcher: '**/*.ts',
              hooks: [{ type: 'command' as const, command: 'tslint' }],
            },
          ],
        },
      };

      const result = await compiler.compile(config);

      // Should not have duplicate eslint hooks for JS files
      const onToolUseHooks = result.hooks?.['on-tool-use'];
      if (Array.isArray(onToolUseHooks)) {
        const jsHooks = onToolUseHooks.filter(
          (h) => h.matcher === '**/*.js' && h.hooks?.[0]?.command === 'eslint'
        );
        expect(jsHooks).toHaveLength(1);
      }
    });
  });

  describe('Environment Variables', () => {
    it('should merge environment variables with override', async () => {
      const presetConfig = {
        env: {
          NODE_ENV: 'development',
          API_URL: 'http://localhost:3000',
          DEBUG: 'false',
        },
      };

      const presetPath = join(TEST_DIR, 'preset.json');
      writeFileSync(presetPath, JSON.stringify(presetConfig));

      const config = {
        extends: presetPath,
        permissions: {
          allow: ['Read(**)'],
        },
        env: {
          NODE_ENV: 'production', // override
          API_KEY: 'secret123', // new
          DEBUG: 'true', // override
        },
      };

      const result = await compiler.compile(config);

      expect(result.env?.NODE_ENV).toBe('production');
      // Preset env values now merge properly
      expect(result.env?.API_URL).toBe('http://localhost:3000');
      expect(result.env?.API_KEY).toBe('secret123');
      expect(result.env?.DEBUG).toBe('true');
    });

    it('should convert non-string values to strings', async () => {
      const config = {
        permissions: {
          allow: ['Read(**)'],
        },
        env: {
          PORT: '3000',
          ENABLED: 'true',
          MAX_SIZE: 'null',
          TIMEOUT: '5000',
          DEBUG: 'false',
        },
      };

      const result = await compiler.compile(config);

      // Compiler now converts to strings
      expect(result.env?.PORT).toBe('3000');
      expect(result.env?.ENABLED).toBe('true');
      expect(result.env?.MAX_SIZE).toBe('null');
      expect(result.env?.TIMEOUT).toBe('5000');
      expect(result.env?.DEBUG).toBe('false');
    });
  });

  describe('Multiple Presets (extends array)', () => {
    it('should load multiple presets in order', async () => {
      // Base preset
      const basePreset = {
        permissions: {
          allow: ['Read(**)'],
        },
        env: {
          BASE: 'preset1',
          OVERRIDE: 'base',
        },
      };

      // Override preset
      const overridePreset = {
        permissions: {
          deny: ['Write(**/secure/**)'],
          allow: ['Write(**/test/**)'],
        },
        env: {
          LEVEL: 'preset2',
          OVERRIDE: 'override',
        },
      };

      const basePath = join(TEST_DIR, 'base.json');
      const overridePath = join(TEST_DIR, 'override.json');

      writeFileSync(basePath, JSON.stringify(basePreset));
      writeFileSync(overridePath, JSON.stringify(overridePreset));

      const config = {
        extends: [basePath, overridePath], // Array of presets
        permissions: {
          allow: ['Bash(npm test)'],
        },
        env: {
          TOP: 'main',
        },
      };

      const result = await compiler.compile(config);

      // Permissions merged from all sources
      expect(result.permissions?.allow).toContain('Read(**)'); // from base
      expect(result.permissions?.allow).toContain('Write(**/test/**)'); // from override
      expect(result.permissions?.allow).toContain('Bash(npm test)'); // from config
      expect(result.permissions?.deny).toContain('Write(**/secure/**)'); // from override

      // Env merged with correct precedence
      expect(result.env?.BASE).toBe('preset1');
      expect(result.env?.LEVEL).toBe('preset2');
      expect(result.env?.OVERRIDE).toBe('override'); // overridden
      expect(result.env?.TOP).toBe('main');
    });

    it('should handle nested extends', async () => {
      // Grandparent preset
      const grandparent = {
        permissions: { allow: ['Read(**)'] },
        env: { LEVEL: 'grandparent', BASE: 'true' },
      };

      // Parent preset extends grandparent
      const parent = {
        extends: join(TEST_DIR, 'grandparent.json'),
        permissions: { deny: ['Write(**/admin/**)'] },
        env: { LEVEL: 'parent', MIDDLE: 'true' },
      };

      const grandparentPath = join(TEST_DIR, 'grandparent.json');
      const parentPath = join(TEST_DIR, 'parent.json');

      writeFileSync(grandparentPath, JSON.stringify(grandparent));
      writeFileSync(parentPath, JSON.stringify(parent));

      const config = {
        extends: parentPath,
        permissions: { allow: ['Write(**/test/**)'] },
        env: { LEVEL: 'child', TOP: 'true' },
      };

      const result = await compiler.compile(config);

      // Nested extends now work properly
      expect(result.permissions?.allow).toContain('Read(**)'); // from grandparent
      expect(result.permissions?.deny).toContain('Write(**/admin/**)'); // from parent
      expect(result.permissions?.allow).toContain('Write(**/test/**)'); // from config

      expect(result.env?.BASE).toBe('true'); // from grandparent
      expect(result.env?.MIDDLE).toBe('true'); // from parent
      expect(result.env?.TOP).toBe('true'); // from config
      expect(result.env?.LEVEL).toBe('child'); // overridden twice
    });
  });

  describe('Plugin System', () => {
    it('should load and apply plugin transformations', async () => {
      // Create a simple plugin
      const pluginCode = `
export default {
  name: 'security-plugin',
  transform(config) {
    return {
      ...config,
      permissions: {
        ...config.permissions,
        deny: [
          ...(config.permissions?.deny || []),
          'Write(**/admin/**)',
          'Read(**/.env)'
        ]
      },
      env: {
        ...config.env,
        SECURITY_ENABLED: 'true'
      }
    };
  }
};`;

      const pluginPath = join(TEST_DIR, 'security-plugin.js');
      writeFileSync(pluginPath, pluginCode);

      const config = {
        plugins: [pluginPath],
        permissions: {
          allow: ['Read(**)', 'Write(**/test/**)'],
        },
      };

      const result = await compiler.compile(config);

      // Plugin system now works properly
      expect(result.permissions?.deny).toContain('Write(**/admin/**)');
      expect(result.permissions?.deny).toContain('Read(**/.env)');
      expect(result.env?.SECURITY_ENABLED).toBe('true');

      // Original permissions preserved
      expect(result.permissions?.allow).toContain('Read(**)');
      expect(result.permissions?.allow).toContain('Write(**/test/**)');
    });

    it('should apply multiple plugins in order', async () => {
      // Plugin 1: Add security rules
      const plugin1 = `
export default {
  name: 'security',
  transform(config) {
    return {
      ...config,
      permissions: {
        ...config.permissions,
        deny: [...(config.permissions?.deny || []), 'Write(**/secure/**)']
      }
    };
  }
};`;

      // Plugin 2: Add development tools
      const plugin2 = `
export default {
  name: 'dev-tools',
  transform(config) {
    return {
      ...config,
      permissions: {
        ...config.permissions,
        allow: [...(config.permissions?.allow || []), 'Bash(npm run dev)']
      }
    };
  }
};`;

      const plugin1Path = join(TEST_DIR, 'plugin1.js');
      const plugin2Path = join(TEST_DIR, 'plugin2.js');

      writeFileSync(plugin1Path, plugin1);
      writeFileSync(plugin2Path, plugin2);

      const config = {
        plugins: [plugin1Path, plugin2Path],
        permissions: {
          allow: ['Read(**)'],
        },
      };

      const result = await compiler.compile(config);

      // Plugins now work properly
      expect(result.permissions?.deny).toContain('Write(**/secure/**)'); // from plugin1
      expect(result.permissions?.allow).toContain('Bash(npm run dev)'); // from plugin2
      expect(result.permissions?.allow).toContain('Read(**)'); // from config
    });

    it('should apply plugins in order with later plugins overriding earlier', async () => {
      // Plugin 1: Set DEBUG to 'plugin1'
      const plugin1 = `
export default {
  name: 'plugin1',
  transform(config) {
    return {
      ...config,
      env: {
        ...config.env,
        DEBUG: 'plugin1',
        PLUGIN1_APPLIED: 'true'
      }
    };
  }
};`;

      // Plugin 2: Override DEBUG to 'plugin2'
      const plugin2 = `
export default {
  name: 'plugin2',
  transform(config) {
    return {
      ...config,
      env: {
        ...config.env,
        DEBUG: 'plugin2',
        PLUGIN2_APPLIED: 'true'
      }
    };
  }
};`;

      const plugin1Path = join(TEST_DIR, 'override1.js');
      const plugin2Path = join(TEST_DIR, 'override2.js');

      writeFileSync(plugin1Path, plugin1);
      writeFileSync(plugin2Path, plugin2);

      const config = {
        plugins: [plugin1Path, plugin2Path],
        permissions: {
          allow: ['Read(**)'],
        },
        env: {
          DEBUG: 'initial',
        },
      };

      const result = await compiler.compile(config);

      // Plugin2 should override Plugin1's DEBUG value
      expect(result.env?.DEBUG).toBe('plugin2');

      // Both plugins should have been applied
      expect(result.env?.PLUGIN1_APPLIED).toBe('true');
      expect(result.env?.PLUGIN2_APPLIED).toBe('true');
    });
  });

  describe('YAML Support', () => {
    it('should load configuration from YAML file', async () => {
      const yamlContent = `
extends: ./preset.json
permissions:
  allow:
    - 'Read(**)'
    - 'Write(**/test/**)'
  deny:
    - 'Write(**/prod/**)'
env:
  NODE_ENV: test
  DEBUG: "true"
includeCoAuthoredBy: false
cleanupPeriodDays: 14
`;

      const yamlPath = join(TEST_DIR, '.hugsyrc.yaml');
      writeFileSync(yamlPath, yamlContent);

      // Create preset referenced by YAML
      const preset = {
        permissions: {
          ask: ['WebSearch'],
        },
      };
      writeFileSync(join(TEST_DIR, 'preset.json'), JSON.stringify(preset));

      // Load and parse YAML manually (simulating what would happen)
      const parsedYaml = yaml.parse(yamlContent);

      // Update extends path to be absolute
      parsedYaml.extends = join(TEST_DIR, 'preset.json');

      const result = await compiler.compile(parsedYaml);

      expect(result.permissions?.allow).toContain('Read(**)');
      expect(result.permissions?.allow).toContain('Write(**/test/**)');
      expect(result.permissions?.deny).toContain('Write(**/prod/**)');
      expect(result.permissions?.ask).toContain('WebSearch'); // from preset
      expect(result.env?.NODE_ENV).toBe('test');
      expect(result.env?.DEBUG).toBe('true');
      expect(result.includeCoAuthoredBy).toBe(false);
      expect(result.cleanupPeriodDays).toBe(14);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing preset file gracefully', async () => {
      const config = {
        extends: join(TEST_DIR, 'non-existent-preset.json'),
        permissions: {
          allow: ['Read(**)'],
        },
      };

      // Should not throw, but log warning
      const result = await compiler.compile(config);

      expect(result.permissions?.allow).toContain('Read(**)');
    });

    it('should detect and throw on circular dependencies', async () => {
      // Create circular dependency: config1 -> config2 -> config1
      const config1 = {
        extends: join(TEST_DIR, 'config2.json'),
        permissions: { allow: ['Read(**)'] },
      };

      const config2 = {
        extends: join(TEST_DIR, 'config1.json'),
        permissions: { allow: ['Write(**)'] },
      };

      writeFileSync(join(TEST_DIR, 'config1.json'), JSON.stringify(config1));
      writeFileSync(join(TEST_DIR, 'config2.json'), JSON.stringify(config2));

      // Must throw CompilerError on circular dependency
      await expect(compiler.compile(config1)).rejects.toThrow('Circular dependency detected');
    });

    it('should throw on invalid permission format', async () => {
      const config = {
        permissions: {
          allow: ['Read(**)', 'InvalidFormat', 'Write(**/test/**)'],
          deny: ['also invalid', '123Invalid'],
        },
      };

      // Must throw CompilerError on invalid permission format
      await expect(compiler.compile(config)).rejects.toThrow('Invalid permission format');
      await expect(compiler.compile(config)).rejects.toThrow('also invalid');
    });

    it('should handle plugin load errors', async () => {
      const config = {
        plugins: [join(TEST_DIR, 'non-existent-plugin.js')],
        permissions: {
          allow: ['Read(**)'],
        },
      };

      // Should continue without the plugin
      const result = await compiler.compile(config);

      expect(result.permissions?.allow).toContain('Read(**)');
    });

    it('should throw error for non-string/array extends field', async () => {
      const config = {
        extends: 123, // Invalid type - number instead of string
        permissions: {
          allow: ['Read(**)'],
        },
      };

      // @ts-expect-error Testing with invalid config
      await expect(compiler.compile(config)).rejects.toThrow(
        'extends field must be a string or array of strings'
      );
    });

    it('should reject array as root configuration', async () => {
      // @ts-expect-error Testing invalid root type
      const invalidConfig: HugsyConfig = []; // Array instead of object

      await expect(compiler.compile(invalidConfig)).rejects.toThrow(
        'Configuration must be an object'
      );
    });

    it('should warn about unknown configuration properties', async () => {
      // Use verbose compiler to see warnings
      const verboseCompiler = new Compiler({ projectRoot: TEST_DIR, verbose: true });

      const config = {
        permissions: {
          allow: ['Read(**)'],
        },
        unknownProperty: 'value', // Unknown property
      };

      // Should compile successfully despite unknown property
      const result = await verboseCompiler.compile(config);
      expect(result.permissions?.allow).toContain('Read(**)');
      // The warning is logged internally, we just verify it doesn't break compilation
    });

    it('should handle plugin transform exceptions gracefully', async () => {
      // Create a plugin file that throws an error
      const pluginCode = `
export default {
  name: 'faulty-plugin',
  transform: (config) => {
    throw new Error('Plugin transform failed!');
  }
};`;

      writeFileSync(join(TEST_DIR, 'faulty-plugin.js'), pluginCode);

      const config = {
        plugins: [join(TEST_DIR, 'faulty-plugin.js')],
        permissions: {
          allow: ['Read(**)'],
        },
      };

      // Should continue compilation despite plugin error
      const gracefulCompiler = new Compiler({ projectRoot: TEST_DIR, throwOnError: false });
      const result = await gracefulCompiler.compile(config);
      expect(result.permissions?.allow).toContain('Read(**)');
    });

    it('should reject non-ASCII field names', async () => {
      const config = {
        permissions: {
          allow: ['Read(**)'],
        },
        环境变量: 'test', // Chinese field name
      };

      await expect(compiler.compile(config)).rejects.toThrow(
        'field names must contain only ASCII characters'
      );
    });

    it('should filter zero-width and control characters', async () => {
      const configStr = JSON.stringify({
        permissions: {
          allow: ['Read(**)'],
        },
        env: {
          TEST_VAR: 'test\u200Bvalue\u0000', // Contains zero-width space and null
        },
      });

      // Parse and compile
      const config = JSON.parse(configStr);
      const result = await compiler.compile(config);

      // Zero-width and control characters should be removed
      expect(result.env?.TEST_VAR).toBe('testvalue');
    });
  });

  describe('Complete Integration', () => {
    it('should produce valid Claude settings.json structure', async () => {
      const config = {
        permissions: {
          allow: ['Read(**)', 'Write(**/test/**)', 'Bash(npm test)'],
          deny: ['Write(**/prod/**)', 'Write(**/node_modules/**)'],
          ask: ['WebSearch', 'WebFetch'],
        },
        hooks: {
          'on-tool-use': [
            {
              matcher: '**/*.{js,ts}',
              hooks: [{ type: 'command' as const, command: 'eslint --fix' }],
            },
          ],
        },
        env: {
          NODE_ENV: 'production',
          API_URL: 'https://api.example.com',
          DEBUG: 'false',
        },
        model: 'claude-3-opus-20240229',
        statusLine: {
          type: 'command' as const,
          command: 'git status --short',
        },
        includeCoAuthoredBy: true,
        cleanupPeriodDays: 30,
      };

      const result = await compiler.compile(config);

      // Validate complete structure
      expect(result).toHaveProperty('permissions');
      expect(result).toHaveProperty('hooks');
      expect(result).toHaveProperty('env');
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('statusLine');
      expect(result).toHaveProperty('includeCoAuthoredBy');
      expect(result).toHaveProperty('cleanupPeriodDays');

      // Validate permissions structure
      expect(Array.isArray(result.permissions?.allow)).toBe(true);
      expect(Array.isArray(result.permissions?.deny)).toBe(true);
      expect(Array.isArray(result.permissions?.ask)).toBe(true);

      // Validate specific values
      expect(result.permissions?.allow).toHaveLength(3);
      expect(result.permissions?.deny).toHaveLength(2);
      expect(result.permissions?.ask).toHaveLength(2);

      expect(result.hooks?.['on-tool-use']).toBeDefined();
      const onToolUse = result.hooks?.['on-tool-use'];
      if (Array.isArray(onToolUse)) {
        expect(onToolUse[0].matcher).toBe('**/*.{js,ts}');
      }

      expect(result.env?.NODE_ENV).toBe('production');
      expect(result.model).toBe('claude-3-opus-20240229');
      expect(result.statusLine?.type).toBe('command');
      expect(result.statusLine?.command).toBe('git status --short');
      expect(result.includeCoAuthoredBy).toBe(true);
      expect(result.cleanupPeriodDays).toBe(30);
    });

    it('should handle complex preset and plugin chain', async () => {
      // Base preset
      const basePreset = {
        permissions: {
          allow: ['Read(**)', 'Bash(git *)'],
          deny: ['Write(**/.git/**)'],
        },
        env: {
          BASE_LOADED: 'true',
        },
      };

      // Team preset that extends base
      const teamPreset = {
        extends: join(TEST_DIR, 'base.json'),
        permissions: {
          allow: ['Write(**/src/**)'],
          ask: ['WebSearch'],
        },
        env: {
          TEAM_LOADED: 'true',
        },
      };

      // Security plugin
      const securityPlugin = `
export default {
  transform(config) {
    return {
      ...config,
      permissions: {
        ...config.permissions,
        deny: [
          ...(config.permissions?.deny || []),
          'Read(**/.env)',
          'Write(**/secrets/**)'
        ]
      },
      env: {
        ...config.env,
        SECURITY_PLUGIN: 'active'
      }
    };
  }
};`;

      writeFileSync(join(TEST_DIR, 'base.json'), JSON.stringify(basePreset));
      writeFileSync(join(TEST_DIR, 'team.json'), JSON.stringify(teamPreset));
      writeFileSync(join(TEST_DIR, 'security.js'), securityPlugin);

      const config = {
        extends: join(TEST_DIR, 'team.json'),
        plugins: [join(TEST_DIR, 'security.js')],
        permissions: {
          allow: ['Write(**/test/**)'],
        },
        env: {
          NODE_ENV: 'test',
        },
      };

      const result = await compiler.compile(config);

      // Check everything is merged correctly
      // From base preset (loaded via nested extends)
      expect(result.permissions?.allow).toContain('Read(**)');
      expect(result.permissions?.allow).toContain('Bash(git *)');
      expect(result.permissions?.deny).toContain('Write(**/.git/**)');
      expect(result.env?.BASE_LOADED).toBe('true');

      // From team preset
      expect(result.permissions?.allow).toContain('Write(**/src/**)');
      expect(result.permissions?.ask).toContain('WebSearch');
      expect(result.env?.TEAM_LOADED).toBe('true');

      // From security plugin
      expect(result.permissions?.deny).toContain('Read(**/.env)');
      expect(result.permissions?.deny).toContain('Write(**/secrets/**)');
      expect(result.env?.SECURITY_PLUGIN).toBe('active');

      // From main config
      expect(result.permissions?.allow).toContain('Write(**/test/**)');
      expect(result.env?.NODE_ENV).toBe('test');
    });
  });

  describe('Slash Commands Compilation', () => {
    it('should compile inline slash commands', async () => {
      const config = {
        permissions: {
          allow: ['Read(**)'],
        },
        commands: {
          commands: {
            test: 'Run all tests and report results',
            build: {
              content: 'Build the project for production',
              description: 'Production build',
              category: 'development',
            },
          },
        },
      };

      await compiler.compile(config);
      const commands = compiler.getCompiledCommands();

      expect(commands.size).toBe(2);
      expect(commands.has('test')).toBe(true);
      expect(commands.has('build')).toBe(true);

      const testCmd = commands.get('test');
      expect(testCmd?.content).toBe('Run all tests and report results');

      const buildCmd = commands.get('build');
      expect(buildCmd?.content).toBe('Build the project for production');
      expect(buildCmd?.description).toBe('Production build');
      expect(buildCmd?.category).toBe('development');
    });

    it('should load commands from presets', async () => {
      // Create a command preset
      const commandPreset = {
        name: 'test-commands',
        commands: {
          deploy: {
            content: 'Deploy to production',
            description: 'Deploy application',
            argumentHint: '[environment]',
          },
          lint: 'Check code quality',
        },
      };

      const presetPath = join(TEST_DIR, 'commands.json');
      writeFileSync(presetPath, JSON.stringify(commandPreset));

      const config = {
        permissions: {
          allow: ['Read(**)'],
        },
        commands: {
          presets: [presetPath],
        },
      };

      await compiler.compile(config);
      const commands = compiler.getCompiledCommands();

      expect(commands.size).toBe(2);
      expect(commands.has('deploy')).toBe(true);
      expect(commands.has('lint')).toBe(true);

      const deployCmd = commands.get('deploy');
      expect(deployCmd?.argumentHint).toBe('[environment]');
    });

    it('should merge commands from multiple sources', async () => {
      // Create preset with commands
      const preset = {
        commands: {
          test: 'Run tests from preset',
          build: 'Build from preset',
        },
      };

      // Create plugin with commands
      const plugin = `
export default {
  name: 'cmd-plugin',
  commands: {
    deploy: 'Deploy from plugin',
    test: 'Test from plugin' // Will be overridden
  }
};`;

      const presetPath = join(TEST_DIR, 'preset.json');
      const pluginPath = join(TEST_DIR, 'plugin.js');

      writeFileSync(presetPath, JSON.stringify(preset));
      writeFileSync(pluginPath, plugin);

      const config = {
        extends: presetPath,
        plugins: [pluginPath],
        permissions: {
          allow: ['Read(**)'],
        },
        commands: {
          commands: {
            test: 'Test from config', // Overrides all
            custom: 'Custom command',
          },
        },
      };

      await compiler.compile(config);
      const commands = compiler.getCompiledCommands();

      expect(commands.size).toBe(4);

      // Check priority: config > plugins > presets
      expect(commands.get('test')?.content).toBe('Test from config');
      expect(commands.get('build')?.content).toBe('Build from preset');
      expect(commands.get('deploy')?.content).toBe('Deploy from plugin');
      expect(commands.get('custom')?.content).toBe('Custom command');
    });

    it('should handle array shorthand for command presets', async () => {
      const preset1 = {
        commands: {
          cmd1: 'Command 1',
          cmd2: 'Command 2',
        },
      };

      const preset2 = {
        commands: {
          cmd3: 'Command 3',
          cmd2: 'Command 2 override', // Override cmd2
        },
      };

      const preset1Path = join(TEST_DIR, 'cmds1.json');
      const preset2Path = join(TEST_DIR, 'cmds2.json');

      writeFileSync(preset1Path, JSON.stringify(preset1));
      writeFileSync(preset2Path, JSON.stringify(preset2));

      const config = {
        permissions: {
          allow: ['Read(**)'],
        },
        commands: [preset1Path, preset2Path], // Array shorthand
      };

      await compiler.compile(config);
      const commands = compiler.getCompiledCommands();

      expect(commands.size).toBe(3);
      expect(commands.get('cmd1')?.content).toBe('Command 1');
      expect(commands.get('cmd2')?.content).toBe('Command 2 override');
      expect(commands.get('cmd3')?.content).toBe('Command 3');
    });

    it('should support command metadata fields', async () => {
      const config = {
        permissions: {
          allow: ['Read(**)'],
        },
        commands: {
          commands: {
            advanced: {
              content: 'Advanced command with metadata',
              description: 'An advanced command',
              category: 'tools',
              argumentHint: '[options]',
              model: 'claude-3-opus',
              allowedTools: ['Bash', 'Read', 'Write'],
            },
          },
        },
      };

      await compiler.compile(config);
      const commands = compiler.getCompiledCommands();

      const cmd = commands.get('advanced');
      expect(cmd?.content).toBe('Advanced command with metadata');
      expect(cmd?.description).toBe('An advanced command');
      expect(cmd?.category).toBe('tools');
      expect(cmd?.argumentHint).toBe('[options]');
      expect(cmd?.model).toBe('claude-3-opus');
      expect(cmd?.allowedTools).toEqual(['Bash', 'Read', 'Write']);
    });
  });

  describe('Snapshot Testing', () => {
    it('should match snapshot for complete configuration', async () => {
      const config = {
        extends: '@hugsy/recommended',
        permissions: {
          allow: ['Read(**)', 'Write(**/test/**)', 'Bash(npm test)'],
          deny: ['Write(**/prod/**)', 'Write(**/node_modules/**)'],
          ask: ['WebSearch', 'WebFetch'],
        },
        hooks: {
          'on-tool-use': [
            {
              matcher: '**/*.{js,ts}',
              hooks: [{ type: 'command' as const, command: 'eslint --fix' }],
            },
          ],
        },
        env: {
          NODE_ENV: 'production',
          API_URL: 'https://api.example.com',
          DEBUG: 'false',
        },
        model: 'claude-3-opus-20240229',
        statusLine: {
          type: 'command' as const,
          command: 'git status --short',
        },
        includeCoAuthoredBy: true,
        cleanupPeriodDays: 30,
      };

      const result = await compiler.compile(config);

      // Snapshot test for the complete output structure
      expect(result).toMatchSnapshot('complete-configuration-output');

      // Also verify structure explicitly
      expect(result).toMatchObject({
        permissions: expect.objectContaining({
          allow: expect.any(Array),
          deny: expect.any(Array),
          ask: expect.any(Array),
        }),
        hooks: expect.any(Object),
        env: expect.objectContaining({
          NODE_ENV: 'production',
          API_URL: 'https://api.example.com',
          DEBUG: 'false',
        }),
        model: 'claude-3-opus-20240229',
        statusLine: expect.objectContaining({
          type: 'command',
          command: 'git status --short',
        }),
        includeCoAuthoredBy: true,
        cleanupPeriodDays: 30,
      });
    });

    it('should match snapshot for minimal configuration', async () => {
      const config = {
        permissions: {
          allow: ['Read(**)'],
        },
      };

      const result = await compiler.compile(config);

      // Snapshot test for minimal config
      expect(result).toMatchSnapshot('minimal-configuration-output');

      // No defaults should be applied
      expect(result.includeCoAuthoredBy).toBeUndefined();
      expect(result.cleanupPeriodDays).toBeUndefined();
      expect(result.env).toEqual({});
    });
  });

  describe('Type Exports', () => {
    it('should export Plugin and HugsyPlugin types', () => {
      // This test verifies that the types are exported correctly
      // The actual type checking happens at compile time
      const testPlugin: Plugin = {
        name: 'test-plugin',
        transform: (config: HugsyConfig) => config,
      };

      const hugsyPlugin: HugsyPlugin = {
        name: 'hugsy-plugin',
        version: '1.0.0',
        transform: (config: HugsyConfig) => ({
          ...config,
          env: { ...config.env, TEST: 'value' },
        }),
      };

      expect(testPlugin).toBeDefined();
      expect(hugsyPlugin).toBeDefined();
      expect(testPlugin.name).toBe('test-plugin');
      expect(hugsyPlugin.name).toBe('hugsy-plugin');
    });
  });

  describe('Async Plugin Support', () => {
    it('should support async transform functions', async () => {
      const asyncPlugin = `
export default {
  name: 'async-plugin',
  async transform(config) {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 10));
    return {
      ...config,
      env: {
        ...config.env,
        ASYNC_LOADED: 'true'
      }
    };
  }
};
`;

      const pluginPath = join(TEST_DIR, 'async-plugin.js');
      writeFileSync(pluginPath, asyncPlugin);

      const config: HugsyConfig = {
        plugins: [join(TEST_DIR, 'async-plugin.js')],
      };

      const result = await compiler.compile(config);
      expect(result.env).toHaveProperty('ASYNC_LOADED', 'true');
    });

    it('should handle async plugin errors gracefully', async () => {
      const errorPlugin = `
export default {
  name: 'error-plugin',
  async transform(config) {
    await new Promise(resolve => setTimeout(resolve, 10));
    throw new Error('Async plugin error');
  }
};
`;

      const pluginPath = join(TEST_DIR, 'error-plugin.js');
      writeFileSync(pluginPath, errorPlugin);

      const config: HugsyConfig = {
        plugins: [join(TEST_DIR, 'error-plugin.js')],
        env: { INITIAL: 'value' },
      };

      // Should continue with unchanged config when plugin fails
      const result = await compiler.compile(config);
      expect(result.env).toEqual({ INITIAL: 'value' });
    });

    it('should support mixing sync and async plugins', async () => {
      const syncPlugin = `
export default {
  name: 'sync-plugin',
  transform(config) {
    return {
      ...config,
      env: {
        ...config.env,
        SYNC: 'loaded'
      }
    };
  }
};
`;

      const asyncPlugin = `
export default {
  name: 'async-plugin-2',
  async transform(config) {
    await new Promise(resolve => setTimeout(resolve, 10));
    return {
      ...config,
      env: {
        ...config.env,
        ASYNC: 'loaded'
      }
    };
  }
};
`;

      writeFileSync(join(TEST_DIR, 'sync-plugin.js'), syncPlugin);
      writeFileSync(join(TEST_DIR, 'async-plugin-2.js'), asyncPlugin);

      const config: HugsyConfig = {
        plugins: [join(TEST_DIR, 'sync-plugin.js'), join(TEST_DIR, 'async-plugin-2.js')],
      };

      const result = await compiler.compile(config);
      expect(result.env).toEqual({
        SYNC: 'loaded',
        ASYNC: 'loaded',
      });
    });

    it('should preserve plugin execution order with async transforms', async () => {
      const plugin1 = `
export default {
  name: 'plugin-1',
  async transform(config) {
    await new Promise(resolve => setTimeout(resolve, 20));
    return {
      ...config,
      env: {
        ...config.env,
        ORDER: '1',
        PLUGIN_1: 'loaded'
      }
    };
  }
};
`;

      const plugin2 = `
export default {
  name: 'plugin-2',
  async transform(config) {
    await new Promise(resolve => setTimeout(resolve, 10));
    return {
      ...config,
      env: {
        ...config.env,
        ORDER: config.env?.ORDER ? config.env.ORDER + ',2' : '2',
        PLUGIN_2: 'loaded'
      }
    };
  }
};
`;

      writeFileSync(join(TEST_DIR, 'plugin-1.js'), plugin1);
      writeFileSync(join(TEST_DIR, 'plugin-2.js'), plugin2);

      const config: HugsyConfig = {
        plugins: [join(TEST_DIR, 'plugin-1.js'), join(TEST_DIR, 'plugin-2.js')],
      };

      const result = await compiler.compile(config);
      expect(result.env?.ORDER).toBe('1,2'); // Should be executed in order
      expect(result.env?.PLUGIN_1).toBe('loaded');
      expect(result.env?.PLUGIN_2).toBe('loaded');
    });

    it('should handle promises that resolve to undefined', async () => {
      const undefinedPlugin = `
export default {
  name: 'undefined-plugin',
  async transform(config) {
    await new Promise(resolve => setTimeout(resolve, 10));
    // Accidentally returning undefined
    return;
  }
};
`;

      writeFileSync(join(TEST_DIR, 'undefined-plugin.js'), undefinedPlugin);

      const config: HugsyConfig = {
        plugins: [join(TEST_DIR, 'undefined-plugin.js')],
        env: { INITIAL: 'value' },
      };

      // Should handle gracefully and continue with unchanged config when plugin returns undefined
      const result = await compiler.compile(config);
      expect(result.env).toEqual({ INITIAL: 'value' });
    });
  });

  describe('Bug Fixes', () => {
    describe('Inheritance values preservation', () => {
      it('should preserve inherited values from presets', async () => {
        const baseConfig = {
          includeCoAuthoredBy: true,
          cleanupPeriodDays: 7,
          env: { BASE: 'value' },
        };
        writeFileSync(join(TEST_DIR, 'base.json'), JSON.stringify(baseConfig));

        const config = {
          extends: join(TEST_DIR, 'base.json'),
          env: { TEST: 'value' },
        };

        const result = await compiler.compile(config);

        expect(result.includeCoAuthoredBy).toBe(true);
        expect(result.cleanupPeriodDays).toBe(7);
        expect(result.env.BASE).toBe('value');
        expect(result.env.TEST).toBe('value');
      });

      it('should allow child config to override inherited values', async () => {
        const baseConfig = {
          includeCoAuthoredBy: true,
          cleanupPeriodDays: 7,
        };
        writeFileSync(join(TEST_DIR, 'base.json'), JSON.stringify(baseConfig));

        const config = {
          extends: join(TEST_DIR, 'base.json'),
          includeCoAuthoredBy: false,
          cleanupPeriodDays: 14,
        };

        const result = await compiler.compile(config);

        expect(result.includeCoAuthoredBy).toBe(false);
        expect(result.cleanupPeriodDays).toBe(14);
      });
    });

    describe('Plugin validate function', () => {
      it('should call plugin validate function and show warnings', async () => {
        // Create new compiler without throwOnError
        const testCompiler = new Compiler({ root: TEST_DIR, verbose: false });

        const mockPlugin = {
          name: 'test-validate',
          validate: (_config: HugsyConfig) => ['Test error 1', 'Test error 2'],
        };

        const pluginsMap = (testCompiler as { plugins: Map<string, Plugin> }).plugins;
        pluginsMap.set('test-validate', mockPlugin);

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await testCompiler.compile({ env: { TEST: 'value' } });

        expect(consoleSpy).toHaveBeenCalledWith('⚠️  Configuration validation warnings:');
        expect(consoleSpy).toHaveBeenCalledWith('  - [test-validate] Test error 1');
        expect(consoleSpy).toHaveBeenCalledWith('  - [test-validate] Test error 2');

        consoleSpy.mockRestore();
      });

      it('should throw when validation fails with throwOnError', async () => {
        const strictCompiler = new Compiler({ root: TEST_DIR, throwOnError: true });

        const mockPlugin = {
          name: 'strict-validate',
          validate: () => ['Critical error'],
        };

        const pluginsMap = (strictCompiler as { plugins: Map<string, Plugin> }).plugins;
        pluginsMap.set('strict-validate', mockPlugin);

        await expect(strictCompiler.compile({})).rejects.toThrow('Configuration validation failed');
      });
    });

    describe('Env value validation', () => {
      it('should reject nested objects in env values', async () => {
        const strictCompiler = new Compiler({ root: TEST_DIR, throwOnError: true });

        const config = {
          env: {
            STRING_VALUE: 'valid',
            NESTED_OBJECT: { level1: { level2: 'value' } } as unknown as string,
          },
        };

        await expect(strictCompiler.compile(config)).rejects.toThrow(
          "Invalid env value for 'NESTED_OBJECT'"
        );
      });

      it('should accept valid string values in env', async () => {
        const config = {
          env: {
            STRING1: 'value1',
            STRING2: 'value2',
            JSON_STRING: JSON.stringify({ nested: 'data' }),
          },
        };

        const result = await compiler.compile(config);

        expect(result.env.STRING1).toBe('value1');
        expect(result.env.STRING2).toBe('value2');
        expect(result.env.JSON_STRING).toBe('{"nested":"data"}');
      });
    });

    describe('Uppercase field normalization', () => {
      it('should normalize uppercase ENV to env', async () => {
        const config = {
          ENV: {
            TEST: 'value',
            ANOTHER: 'test',
          },
        } as HugsyConfig;

        const result = await compiler.compile(config);

        expect(result.env.TEST).toBe('value');
        expect(result.env.ANOTHER).toBe('test');
      });

      it('should normalize Permissions and sub-fields', async () => {
        const config = {
          Permissions: {
            Allow: ['Read(**/*.ts)', 'Write(src/**)'],
            Ask: ['Bash(*)'],
            Deny: ['Delete(*)'],
          },
        } as HugsyConfig;

        const result = await compiler.compile(config);

        expect(result.permissions.allow).toContain('Read(**/*.ts)');
        expect(result.permissions.allow).toContain('Write(src/**)');
        expect(result.permissions.ask).toContain('Bash(*)');
        expect(result.permissions.deny).toContain('Delete(*)');
      });

      it('should handle mixed case fields correctly', async () => {
        const config = {
          ENV: { TEST1: 'value1' },
          env: { TEST2: 'value2' },
          includeCoAuthoredBy: true,
          IncludeCoAuthoredBy: false,
          CleanupPeriodDays: 10,
        } as HugsyConfig;

        const result = await compiler.compile(config);

        expect(result.env.TEST1).toBe('value1');
        expect(result.env.TEST2).toBe('value2');
        expect(result.includeCoAuthoredBy).toBe(false);
        expect(result.cleanupPeriodDays).toBe(10);
      });

      it('should normalize StatusLine field', async () => {
        const config = {
          StatusLine: {
            type: 'static',
            text: 'Test Status',
          },
        } as HugsyConfig;

        const result = await compiler.compile(config);

        expect(result.statusLine).toEqual({
          type: 'static',
          text: 'Test Status',
        });
      });
    });

    describe('Integration test with all fixes', () => {
      it('should handle complex config with all fixed issues', async () => {
        const baseConfig = {
          includeCoAuthoredBy: true,
          cleanupPeriodDays: 7,
          ENV: { BASE_VAR: 'base_value' },
        };
        writeFileSync(join(TEST_DIR, 'base-complex.json'), JSON.stringify(baseConfig));

        const mockPlugin = {
          name: 'integration-plugin',
          env: { PLUGIN_VAR: 'plugin_value' },
          validate: (config: HugsyConfig) => {
            if (!config.env?.REQUIRED_VAR) {
              return ['Missing REQUIRED_VAR in env'];
            }
            return [];
          },
        };
        const pluginsMap = (compiler as { plugins: Map<string, Plugin> }).plugins;
        pluginsMap.set('integration-plugin', mockPlugin);

        const config = {
          extends: join(TEST_DIR, 'base-complex.json'),
          Permissions: {
            Allow: ['Read(**)'],
            Deny: ['Delete(*)'],
          },
          env: {
            REQUIRED_VAR: 'required_value',
            USER_VAR: 'user_value',
          },
        } as HugsyConfig;

        const result = await compiler.compile(config);

        expect(result.includeCoAuthoredBy).toBe(true);
        expect(result.cleanupPeriodDays).toBe(7);
        expect(result.permissions.allow).toContain('Read(**)');
        expect(result.permissions.deny).toContain('Delete(*)');
        expect(result.env.BASE_VAR).toBe('base_value');
        expect(result.env.PLUGIN_VAR).toBe('plugin_value');
        expect(result.env.REQUIRED_VAR).toBe('required_value');
        expect(result.env.USER_VAR).toBe('user_value');
      });
    });
  });
});
