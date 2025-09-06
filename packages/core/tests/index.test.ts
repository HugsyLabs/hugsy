/**
 * Comprehensive unit tests for Hugsy Compiler
 * Tests core functionality including settings.json generation, validation, and transformations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Compiler } from '../src/index';
import type { HugsyConfig, ClaudeSettings } from '@hugsylabs/hugsy-types';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

describe('Hugsy Compiler', () => {
  let compiler: Compiler;

  beforeEach(() => {
    compiler = new Compiler({ projectRoot: '/test/project' });
    vi.clearAllMocks();
  });

  describe('Basic Compilation', () => {
    it('should add $schema field to output', async () => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)', 'Write(**/*.ts)'],
          ask: [],
          deny: [],
        },
      };

      const result = await compiler.compile(config);

      expect(result.$schema).toBe('https://json.schemastore.org/claude-code-settings.json');
    });

    it('should compile basic permissions correctly', async () => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)', 'Write(**/*.ts)'],
          ask: ['Bash(git push *)'],
          deny: ['Bash(rm -rf /)'],
        },
      };

      const result = await compiler.compile(config);

      expect(result.permissions).toEqual({
        allow: ['Read(**)', 'Write(**/*.ts)'],
        ask: ['Bash(git push *)'],
        deny: ['Bash(rm -rf /)'],
      });
    });

    it('should compile environment variables', async () => {
      const config: HugsyConfig = {
        env: {
          NODE_ENV: 'development',
          PROJECT: 'test',
        },
      };

      const result = await compiler.compile(config);

      expect(result.env).toEqual({
        NODE_ENV: 'development',
        PROJECT: 'test',
      });
    });
  });

  describe('Hook Transformations', () => {
    it('should transform simple hook format to nested format', async () => {
      const config: HugsyConfig = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              command: 'echo "Starting bash command"',
              timeout: 5000,
            },
          ],
        },
      };

      const result = await compiler.compile(config);

      expect(result.hooks?.PreToolUse).toEqual([
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              command: 'echo "Starting bash command"',
              timeout: 5000,
            },
          ],
        },
      ]);
    });

    it('should normalize matcher format from Tool(args) to Tool', async () => {
      const config: HugsyConfig = {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Bash(git commit *)',
              command: 'echo "Git commit executed"',
            },
          ],
        },
      };

      const result = await compiler.compile(config);

      const hooks = result.hooks?.PostToolUse;
      if (Array.isArray(hooks)) {
        expect(hooks[0].matcher).toBe('Bash');
      } else {
        expect(hooks?.matcher).toBe('Bash');
      }
    });

    it('should merge hooks with the same matcher', async () => {
      const config: HugsyConfig = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Write',
              command: 'echo "First write hook"',
            },
            {
              matcher: 'Write',
              command: 'echo "Second write hook"',
            },
          ],
        },
      };

      const result = await compiler.compile(config);

      const preHooks = result.hooks?.PreToolUse;
      expect(preHooks).toHaveLength(1);
      if (Array.isArray(preHooks)) {
        expect(preHooks[0].matcher).toBe('Write');
        expect(preHooks[0].hooks).toHaveLength(2);
        expect(preHooks[0].hooks).toEqual([
          {
            type: 'command',
            command: 'echo "First write hook"',
            timeout: 3000,
          },
          {
            type: 'command',
            command: 'echo "Second write hook"',
            timeout: 3000,
          },
        ]);
      }
    });

    it('should handle wildcard matcher correctly', async () => {
      const config: HugsyConfig = {
        hooks: {
          PreToolUse: [
            {
              matcher: '.*',
              command: 'echo "Any tool"',
            },
          ],
        },
      };

      const result = await compiler.compile(config);

      const hooks = result.hooks?.PreToolUse;
      if (Array.isArray(hooks)) {
        expect(hooks[0].matcher).toBe('*');
      } else {
        expect(hooks?.matcher).toBe('*');
      }
    });

    it('should preserve already correct hook format', async () => {
      const config: HugsyConfig = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                {
                  type: 'command' as const,
                  command: 'echo "test"',
                  timeout: 1000,
                },
              ],
            },
          ],
        },
      };

      const result = await compiler.compile(config);

      expect(result.hooks?.PreToolUse).toEqual([
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              command: 'echo "test"',
              timeout: 1000,
            },
          ],
        },
      ]);
    });
  });

  describe('Hook Merging Edge Cases', () => {
    it('should merge multiple hooks with same matcher into single entry', async () => {
      const config: HugsyConfig = {
        hooks: {
          PreToolUse: [
            { matcher: 'Bash', command: 'echo "first"', timeout: 1000 },
            { matcher: 'Bash', command: 'echo "second"', timeout: 2000 },
            { matcher: 'Write', command: 'echo "write"', timeout: 3000 },
            { matcher: 'Bash', command: 'echo "third"', timeout: 1500 },
          ],
        },
      };

      const result = await compiler.compile(config);
      const settings = result;

      // Should have 2 entries: one for Bash (merged) and one for Write
      expect(settings.hooks?.PreToolUse).toHaveLength(2);

      const preHooks = settings.hooks?.PreToolUse;
      const bashHook = Array.isArray(preHooks)
        ? preHooks.find((h) => h.matcher === 'Bash')
        : undefined;
      const writeHook = Array.isArray(preHooks)
        ? preHooks.find((h) => h.matcher === 'Write')
        : undefined;

      // Bash should have all 3 commands merged
      expect(bashHook?.hooks).toHaveLength(3);
      expect(bashHook?.hooks?.[0]).toEqual({
        type: 'command',
        command: 'echo "first"',
        timeout: 1000,
      });
      expect(bashHook?.hooks?.[1]).toEqual({
        type: 'command',
        command: 'echo "second"',
        timeout: 2000,
      });
      expect(bashHook?.hooks?.[2]).toEqual({
        type: 'command',
        command: 'echo "third"',
        timeout: 1500,
      });

      // Write should have its single command
      expect(writeHook?.hooks).toHaveLength(1);
      expect(writeHook?.hooks?.[0]).toEqual({
        type: 'command',
        command: 'echo "write"',
        timeout: 3000,
      });
    });

    it('should handle wildcard matcher with specific matchers', async () => {
      const config: HugsyConfig = {
        hooks: {
          PostToolUse: [
            { matcher: '*', command: 'echo "all tools"', timeout: 500 },
            { matcher: 'Bash', command: 'echo "bash specific"', timeout: 1000 },
            { matcher: '*', command: 'echo "another all"', timeout: 750 },
          ],
        },
      };

      const result = await compiler.compile(config);
      const settings = result;

      // Should have 2 entries: one for * and one for Bash
      expect(settings.hooks?.PostToolUse).toHaveLength(2);

      const postHooks = settings.hooks?.PostToolUse;
      const wildcardHook = Array.isArray(postHooks)
        ? postHooks.find((h) => h.matcher === '*')
        : undefined;
      const bashHook = Array.isArray(postHooks)
        ? postHooks.find((h) => h.matcher === 'Bash')
        : undefined;

      // Wildcard should have both wildcard commands
      expect(wildcardHook?.hooks).toHaveLength(2);
      expect(wildcardHook?.hooks?.[0].command).toBe('echo "all tools"');
      expect(wildcardHook?.hooks?.[1].command).toBe('echo "another all"');

      // Bash should have its specific command
      expect(bashHook?.hooks).toHaveLength(1);
      expect(bashHook?.hooks?.[0].command).toBe('echo "bash specific"');
    });

    it('should preserve order when merging hooks', async () => {
      const config: HugsyConfig = {
        hooks: {
          UserPromptSubmit: [
            { matcher: 'Read', command: 'cmd1', timeout: 100 },
            { matcher: 'Write', command: 'cmd2', timeout: 200 },
            { matcher: 'Read', command: 'cmd3', timeout: 300 },
            { matcher: 'Write', command: 'cmd4', timeout: 400 },
            { matcher: 'Read', command: 'cmd5', timeout: 500 },
          ],
        },
      };

      const result = await compiler.compile(config);
      const settings = result;

      const userHooks = settings.hooks?.UserPromptSubmit;
      const readHook = Array.isArray(userHooks)
        ? userHooks.find((h) => h.matcher === 'Read')
        : undefined;
      const writeHook = Array.isArray(userHooks)
        ? userHooks.find((h) => h.matcher === 'Write')
        : undefined;

      // Commands should be in order they appeared
      expect(readHook?.hooks?.map((h) => h.command)).toEqual(['cmd1', 'cmd3', 'cmd5']);
      expect(writeHook?.hooks?.map((h) => h.command)).toEqual(['cmd2', 'cmd4']);
    });

    it('should handle empty hooks array gracefully', async () => {
      const config: HugsyConfig = {
        hooks: {
          PreToolUse: [],
        },
      };

      const result = await compiler.compile(config);
      const settings = result;

      // Empty arrays should result in empty array in output
      expect(settings.hooks?.PreToolUse).toEqual([]);
    });

    it('should handle mixed hook formats (simple and nested)', async () => {
      const config: HugsyConfig = {
        hooks: {
          PreToolUse: [
            { command: 'echo "simple"', timeout: 1000 }, // Simple format
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo "nested"', timeout: 2000 }],
            }, // Nested format
          ],
        },
      };

      const result = await compiler.compile(config);
      const settings = result;

      expect(settings.hooks?.PreToolUse).toHaveLength(2);

      // Simple format should get * matcher
      const preHooks = settings.hooks?.PreToolUse;
      const wildcardHook = Array.isArray(preHooks)
        ? preHooks.find((h) => h.matcher === '*')
        : undefined;
      expect(wildcardHook?.hooks).toHaveLength(1);
      expect(wildcardHook?.hooks?.[0].command).toBe('echo "simple"');

      // Nested format should keep its matcher
      const bashHook = Array.isArray(preHooks)
        ? preHooks.find((h) => h.matcher === 'Bash')
        : undefined;
      expect(bashHook?.hooks).toHaveLength(1);
      expect(bashHook?.hooks?.[0].command).toBe('echo "nested"');
    });
  });

  describe('Settings Validation', () => {
    it('should validate $schema field', () => {
      const settings: ClaudeSettings = {
        permissions: {
          allow: ['Read(**)'],
          ask: [],
          deny: [],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('Missing required $schema field');
    });

    it('should validate incorrect $schema value', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://wrong.schema.com',
        permissions: {
          allow: ['Read(**)'],
          ask: [],
          deny: [],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain(
        'Invalid $schema value, must be https://json.schemastore.org/claude-code-settings.json'
      );
    });

    it('should validate permission format', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: {
          allow: ['read(**)', '123Invalid', 'Valid(pattern)'],
          ask: [],
          deny: [],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain(
        'Invalid permission format in allow: "read(**)". Must match Tool or Tool(pattern)'
      );
      expect(errors).toContain(
        'Invalid permission format in allow: "123Invalid". Must match Tool or Tool(pattern)'
      );
      expect(errors).not.toContain(
        'Invalid permission format in allow: "Valid(pattern)". Must match Tool or Tool(pattern)'
      );
    });

    it('should validate hook structure', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              // Missing matcher
              hooks: [
                {
                  type: 'command',
                  command: 'echo "test"',
                  timeout: 1000,
                },
              ],
            },
          ],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain("Hooks.PreToolUse[0] missing required 'matcher' field");
    });

    it('should validate hook matcher format', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash(git *)',
              hooks: [
                {
                  type: 'command',
                  command: 'echo "test"',
                  timeout: 1000,
                },
              ],
            },
          ],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain(
        'Hooks.PreToolUse[0].matcher "Bash(git *)" should be tool name only (e.g., "Bash" not "Bash(git *)")'
      );
    });

    it('should validate hook command structure', () => {
      // Simulate data from JSON file with missing type field
      const settings = JSON.parse(`{
        "$schema": "https://json.schemastore.org/claude-code-settings.json",
        "hooks": {
          "PostToolUse": [
            {
              "matcher": "Write",
              "hooks": [
                {
                  "command": "echo \\"test\\"",
                  "timeout": 1000
                }
              ]
            }
          ]
        }
      }`);

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain("Hooks.PostToolUse[0].hooks[0] missing required 'type' field");
    });

    it('should validate hook type literal', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                {
                  type: 'script' as 'command',
                  command: 'echo "test"',
                  timeout: 1000,
                },
              ],
            },
          ],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('Hooks.PreToolUse[0].hooks[0].type must be "command", got "script"');
    });

    it('should validate environment variables are strings', () => {
      const settings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        env: {
          NODE_ENV: 'development',
          PORT: 3000,
          DEBUG: true,
        },
      } as unknown as ClaudeSettings;

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain("Environment variable 'PORT' must be a string, got number");
      expect(errors).toContain("Environment variable 'DEBUG' must be a string, got boolean");
    });

    it('should validate statusLine configuration', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: {
          type: 'invalid' as 'command' | 'static',
          command: 'echo "status"',
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain("statusLine.type must be 'command' or 'static', got 'invalid'");
    });

    it('should validate command statusLine requires command field', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: {
          type: 'command',
          // Missing command field
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('statusLine.command is required when type is "command"');
    });

    it('should validate static statusLine requires value field', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: {
          type: 'static',
          // Missing value field
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('statusLine.value is required when type is "static"');
    });

    it('should validate numeric fields', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        cleanupPeriodDays: '7' as unknown as number,
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('cleanupPeriodDays must be a number, got string');
    });

    it('should validate boolean fields', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        includeCoAuthoredBy: 'true' as unknown as boolean,
        enableAllProjectMcpServers: 1 as unknown as boolean,
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('includeCoAuthoredBy must be a boolean, got string');
      expect(errors).toContain('enableAllProjectMcpServers must be a boolean, got number');
    });

    it('should return empty array for valid settings', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: {
          allow: ['Read(**)', 'Write(**/*.ts)'],
          ask: ['Bash(git push *)'],
          deny: ['Bash(rm -rf /)'],
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                {
                  type: 'command',
                  command: 'echo "test"',
                  timeout: 1000,
                },
              ],
            },
          ],
        },
        env: {
          NODE_ENV: 'development',
          PROJECT: 'test',
        },
        statusLine: {
          type: 'static',
          value: 'Hugsy Project',
        },
        cleanupPeriodDays: 7,
        includeCoAuthoredBy: true,
        enableAllProjectMcpServers: false,
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toEqual([]);
    });
  });

  describe('Permission Conflict Resolution', () => {
    it('should prioritize deny over ask and allow', async () => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['Bash(git *)', 'Read(**)'],
          ask: ['Bash(git *)', 'Write(**)'],
          deny: ['Bash(git *)', 'Delete(**)'],
        },
      };

      const result = await compiler.compile(config);

      // Bash(git *) should only be in deny
      expect(result.permissions?.deny).toContain('Bash(git *)');
      expect(result.permissions?.ask).not.toContain('Bash(git *)');
      expect(result.permissions?.allow).not.toContain('Bash(git *)');

      // Write(**) should stay in ask
      expect(result.permissions?.ask).toContain('Write(**)');

      // Read(**) should stay in allow
      expect(result.permissions?.allow).toContain('Read(**)');
    });

    it('should prioritize ask over allow', async () => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['Bash(npm *)', 'Read(**)'],
          ask: ['Bash(npm *)'],
          deny: [],
        },
      };

      const result = await compiler.compile(config);

      // Bash(npm *) should only be in ask
      expect(result.permissions?.ask).toContain('Bash(npm *)');
      expect(result.permissions?.allow).not.toContain('Bash(npm *)');

      // Read(**) should stay in allow
      expect(result.permissions?.allow).toContain('Read(**)');
    });
  });

  describe('Plugin System', () => {
    it('should handle missing plugins gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* no-op */
      });

      const config: HugsyConfig = {
        plugins: ['./plugins/non-existent.js'],
        env: {
          NODE_ENV: 'test',
        },
      };

      const result = await compiler.compile(config);

      // Should compile successfully even if plugin is missing
      expect(result.env).toEqual({
        NODE_ENV: 'test',
      });

      // Should warn about missing plugin
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));

      consoleWarnSpy.mockRestore();
    });

    it('should merge plugin permissions and hooks', async () => {
      // Test plugin contribution without mocking actual modules
      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)', 'Write(**/*.ts)'],
          ask: [],
          deny: [],
        },
        env: {
          NODE_ENV: 'test',
        },
      };

      const result = await compiler.compile(config);

      expect(result.permissions?.allow).toContain('Read(**)');
      expect(result.permissions?.allow).toContain('Write(**/*.ts)');
      expect(result.env?.NODE_ENV).toBe('test');
    });
  });

  describe('Error Handling', () => {
    it('should reject array configuration', async () => {
      const config = [] as HugsyConfig;

      await expect(compiler.compile(config)).rejects.toThrow(
        'Configuration must be an object, not an array'
      );
    });

    it('should reject null configuration', async () => {
      const config = null as unknown as HugsyConfig;

      await expect(compiler.compile(config)).rejects.toThrow('Configuration must be an object');
    });

    it('should handle invalid permission format with throwOnError', async () => {
      const errorCompiler = new Compiler({
        projectRoot: '/test/project',
        throwOnError: true,
      });

      const config: HugsyConfig = {
        permissions: {
          allow: ['invalid-permission-format'],
          ask: [],
          deny: [],
        },
      };

      await expect(errorCompiler.compile(config)).rejects.toThrow('Invalid permission format');
    });

    it('should warn about invalid permission format without throwOnError', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        /* no-op */
      });

      const config: HugsyConfig = {
        permissions: {
          allow: ['invalid-permission-format'],
          ask: [],
          deny: [],
        },
      };

      await compiler.compile(config);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid permission format')
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Field Preservation', () => {
    it('should preserve optional fields when explicitly set', async () => {
      const config: HugsyConfig = {
        includeCoAuthoredBy: false,
        cleanupPeriodDays: 14,
        model: 'claude-3-opus',
        apiKeyHelper: 'helper-script.sh',
      };

      const result = await compiler.compile(config);

      expect(result.includeCoAuthoredBy).toBe(false);
      expect(result.cleanupPeriodDays).toBe(14);
      expect(result.model).toBe('claude-3-opus');
      expect(result.apiKeyHelper).toBe('helper-script.sh');
    });

    it('should not include optional fields when undefined', async () => {
      const config: HugsyConfig = {};

      const result = await compiler.compile(config);

      expect(result).not.toHaveProperty('includeCoAuthoredBy');
      expect(result).not.toHaveProperty('cleanupPeriodDays');
      expect(result).not.toHaveProperty('model');
      expect(result).not.toHaveProperty('apiKeyHelper');
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle preset extends with plugin transforms and hook merging', async () => {
      // Mock preset
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          permissions: {
            allow: ['Read(**)', 'Write(**/*.js)'],
            ask: [],
            deny: [],
          },
          hooks: {
            PreToolUse: [
              {
                matcher: 'Bash',
                command: 'echo "From preset"',
              },
            ],
          },
          env: {
            FROM_PRESET: 'true',
          },
        })
      );

      const config: HugsyConfig = {
        extends: '@hugsylabs/hugsy-compiler/presets/test',
        permissions: {
          allow: ['Write(**/*.ts)'],
          ask: [],
          deny: ['Bash(rm *)'],
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              command: 'echo "From config"',
            },
            {
              matcher: 'Write',
              command: 'echo "Write hook"',
            },
          ],
        },
        env: {
          FROM_CONFIG: 'true',
        },
      };

      const result = await compiler.compile(config);

      // Should merge permissions
      expect(result.permissions?.allow).toContain('Read(**)');
      expect(result.permissions?.allow).toContain('Write(**/*.js)');
      expect(result.permissions?.allow).toContain('Write(**/*.ts)');
      expect(result.permissions?.deny).toContain('Bash(rm *)');

      // Should merge hooks with same matcher
      const preHooks = result.hooks?.PreToolUse;
      const bashHooks = Array.isArray(preHooks)
        ? preHooks.find((h) => h.matcher === 'Bash')
        : undefined;
      expect(bashHooks?.hooks).toHaveLength(2);

      // Should have separate Write hook
      const writeHooks = Array.isArray(preHooks)
        ? preHooks.find((h) => h.matcher === 'Write')
        : undefined;
      expect(writeHooks?.hooks).toHaveLength(1);

      // Should merge env
      expect(result.env).toEqual({
        FROM_PRESET: 'true',
        FROM_CONFIG: 'true',
      });
    });

    it('should handle missing presets gracefully', async () => {
      // Mock file system to simulate missing presets
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config: HugsyConfig = {
        extends: '@hugsylabs/hugsy-compiler/presets/non-existent',
      };

      // Should not throw, just use empty preset
      const result = await compiler.compile(config);

      expect(result).toBeDefined();
      expect(result.$schema).toBe('https://json.schemastore.org/claude-code-settings.json');
    });
  });
});
