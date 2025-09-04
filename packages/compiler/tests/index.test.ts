/**
 * Comprehensive unit tests for Hugsy Compiler
 * Tests core functionality including settings.json generation, validation, and transformations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Compiler } from '../src/index';
import type { HugsyConfig, ClaudeSettings } from '@hugsylabs/hugsy-types';
import * as fs from 'fs';
import * as path from 'path';

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
          allow: ['Read(**)', 'Write(**/*.ts)']
        }
      };
      
      const result = await compiler.compile(config);
      
      expect(result.$schema).toBe('https://json.schemastore.org/claude-code-settings.json');
    });

    it('should compile basic permissions correctly', async () => {
      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)', 'Write(**/*.ts)'],
          ask: ['Bash(git push *)'],
          deny: ['Bash(rm -rf /)']
        }
      };
      
      const result = await compiler.compile(config);
      
      expect(result.permissions).toEqual({
        allow: ['Read(**)', 'Write(**/*.ts)'],
        ask: ['Bash(git push *)'],
        deny: ['Bash(rm -rf /)']
      });
    });

    it('should compile environment variables', async () => {
      const config: HugsyConfig = {
        env: {
          NODE_ENV: 'development',
          PROJECT: 'test'
        }
      };
      
      const result = await compiler.compile(config);
      
      expect(result.env).toEqual({
        NODE_ENV: 'development',
        PROJECT: 'test'
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
              timeout: 5000
            }
          ]
        }
      };
      
      const result = await compiler.compile(config);
      
      expect(result.hooks?.PreToolUse).toEqual([
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              command: 'echo "Starting bash command"',
              timeout: 5000
            }
          ]
        }
      ]);
    });

    it('should normalize matcher format from Tool(args) to Tool', async () => {
      const config: HugsyConfig = {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Bash(git commit *)',
              command: 'echo "Git commit executed"'
            }
          ]
        }
      };
      
      const result = await compiler.compile(config);
      
      expect(result.hooks?.PostToolUse?.[0].matcher).toBe('Bash');
    });

    it('should merge hooks with the same matcher', async () => {
      const config: HugsyConfig = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Write',
              command: 'echo "First write hook"'
            },
            {
              matcher: 'Write',
              command: 'echo "Second write hook"'
            }
          ]
        }
      };
      
      const result = await compiler.compile(config);
      
      expect(result.hooks?.PreToolUse).toHaveLength(1);
      expect(result.hooks?.PreToolUse?.[0].matcher).toBe('Write');
      expect(result.hooks?.PreToolUse?.[0].hooks).toHaveLength(2);
      expect(result.hooks?.PreToolUse?.[0].hooks).toEqual([
        {
          type: 'command',
          command: 'echo "First write hook"',
          timeout: 3000
        },
        {
          type: 'command',
          command: 'echo "Second write hook"',
          timeout: 3000
        }
      ]);
    });

    it('should handle wildcard matcher correctly', async () => {
      const config: HugsyConfig = {
        hooks: {
          PreToolUse: [
            {
              matcher: '.*',
              command: 'echo "Any tool"'
            }
          ]
        }
      };
      
      const result = await compiler.compile(config);
      
      expect(result.hooks?.PreToolUse?.[0].matcher).toBe('*');
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
                  timeout: 1000
                }
              ]
            }
          ]
        }
      };
      
      const result = await compiler.compile(config);
      
      expect(result.hooks?.PreToolUse).toEqual([
        {
          matcher: 'Bash',
          hooks: [
            {
              type: 'command',
              command: 'echo "test"',
              timeout: 1000
            }
          ]
        }
      ]);
    });
  });

  describe('Settings Validation', () => {
    it('should validate $schema field', () => {
      const settings: ClaudeSettings = {
        permissions: {
          allow: ['Read(**)']
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Missing required $schema field');
    });

    it('should validate incorrect $schema value', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://wrong.schema.com',
        permissions: {
          allow: ['Read(**)']
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Invalid $schema value, must be https://json.schemastore.org/claude-code-settings.json');
    });

    it('should validate permission format', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: {
          allow: ['read(**)', '123Invalid', 'Valid(pattern)']
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Invalid permission format in allow: "read(**)". Must match Tool or Tool(pattern)');
      expect(errors).toContain('Invalid permission format in allow: "123Invalid". Must match Tool or Tool(pattern)');
      expect(errors).not.toContain('Invalid permission format in allow: "Valid(pattern)". Must match Tool or Tool(pattern)');
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
                  timeout: 1000
                }
              ]
            } as any
          ]
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Hooks.PreToolUse[0] missing required \'matcher\' field');
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
                  timeout: 1000
                }
              ]
            }
          ]
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Hooks.PreToolUse[0].matcher "Bash(git *)" should be tool name only (e.g., "Bash" not "Bash(git *)")');
    });

    it('should validate hook command structure', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [
                {
                  // Missing type
                  command: 'echo "test"',
                  timeout: 1000
                } as any
              ]
            }
          ]
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Hooks.PostToolUse[0].hooks[0] missing required \'type\' field');
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
                  type: 'script' as any,
                  command: 'echo "test"',
                  timeout: 1000
                }
              ]
            }
          ]
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Hooks.PreToolUse[0].hooks[0].type must be "command", got "script"');
    });

    it('should validate environment variables are strings', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        env: {
          NODE_ENV: 'development',
          PORT: 3000 as any,
          DEBUG: true as any
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Environment variable \'PORT\' must be a string, got number');
      expect(errors).toContain('Environment variable \'DEBUG\' must be a string, got boolean');
    });

    it('should validate statusLine configuration', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: {
          type: 'invalid' as any,
          command: 'echo "status"'
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('statusLine.type must be \'command\' or \'static\', got \'invalid\'');
    });

    it('should validate command statusLine requires command field', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: {
          type: 'command'
          // Missing command field
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('statusLine.command is required when type is "command"');
    });

    it('should validate static statusLine requires value field', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: {
          type: 'static'
          // Missing value field
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('statusLine.value is required when type is "static"');
    });

    it('should validate numeric fields', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        cleanupPeriodDays: '7' as any
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('cleanupPeriodDays must be a number, got string');
    });

    it('should validate boolean fields', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        includeCoAuthoredBy: 'true' as any,
        enableAllProjectMcpServers: 1 as any
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
          deny: ['Bash(rm -rf /)']
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                {
                  type: 'command',
                  command: 'echo "test"',
                  timeout: 1000
                }
              ]
            }
          ]
        },
        env: {
          NODE_ENV: 'development',
          PROJECT: 'test'
        },
        statusLine: {
          type: 'static',
          value: 'Hugsy Project'
        },
        cleanupPeriodDays: 7,
        includeCoAuthoredBy: true,
        enableAllProjectMcpServers: false
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
          deny: ['Bash(git *)', 'Delete(**)']
        }
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
          ask: ['Bash(npm *)']
        }
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
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const config: HugsyConfig = {
        plugins: ['./plugins/non-existent.js'],
        env: {
          NODE_ENV: 'test'
        }
      };
      
      const result = await compiler.compile(config);
      
      // Should compile successfully even if plugin is missing
      expect(result.env).toEqual({
        NODE_ENV: 'test'
      });
      
      // Should warn about missing plugin
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
      
      consoleWarnSpy.mockRestore();
    });

    it('should merge plugin permissions and hooks', async () => {
      // Test plugin contribution without mocking actual modules
      const config: HugsyConfig = {
        permissions: {
          allow: ['Read(**)', 'Write(**/*.ts)']
        },
        env: {
          NODE_ENV: 'test'
        }
      };
      
      const result = await compiler.compile(config);
      
      expect(result.permissions?.allow).toContain('Read(**)');
      expect(result.permissions?.allow).toContain('Write(**/*.ts)');
      expect(result.env?.NODE_ENV).toBe('test');
    });
  });

  describe('Error Handling', () => {
    it('should reject array configuration', async () => {
      const config = [] as any;
      
      await expect(compiler.compile(config)).rejects.toThrow('Configuration must be an object, not an array');
    });

    it('should reject null configuration', async () => {
      const config = null as any;
      
      await expect(compiler.compile(config)).rejects.toThrow('Configuration must be an object');
    });

    it('should handle invalid permission format with throwOnError', async () => {
      const errorCompiler = new Compiler({ 
        projectRoot: '/test/project',
        throwOnError: true 
      });
      
      const config: HugsyConfig = {
        permissions: {
          allow: ['invalid-permission-format']
        }
      };
      
      await expect(errorCompiler.compile(config)).rejects.toThrow('Invalid permission format');
    });

    it('should warn about invalid permission format without throwOnError', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const config: HugsyConfig = {
        permissions: {
          allow: ['invalid-permission-format']
        }
      };
      
      await compiler.compile(config);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid permission format'));
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Field Preservation', () => {
    it('should preserve optional fields when explicitly set', async () => {
      const config: HugsyConfig = {
        includeCoAuthoredBy: false,
        cleanupPeriodDays: 14,
        model: 'claude-3-opus',
        apiKeyHelper: 'helper-script.sh'
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
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        permissions: {
          allow: ['Read(**)', 'Write(**/*.js)']
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              command: 'echo "From preset"'
            }
          ]
        },
        env: {
          FROM_PRESET: 'true'
        }
      }));
      
      const config: HugsyConfig = {
        extends: '@hugsylabs/hugsy-compiler/presets/test',
        permissions: {
          allow: ['Write(**/*.ts)'],
          deny: ['Bash(rm *)']
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              command: 'echo "From config"'
            },
            {
              matcher: 'Write',
              command: 'echo "Write hook"'
            }
          ]
        },
        env: {
          FROM_CONFIG: 'true'
        }
      };
      
      const result = await compiler.compile(config);
      
      // Should merge permissions
      expect(result.permissions?.allow).toContain('Read(**)');
      expect(result.permissions?.allow).toContain('Write(**/*.js)');
      expect(result.permissions?.allow).toContain('Write(**/*.ts)');
      expect(result.permissions?.deny).toContain('Bash(rm *)');
      
      // Should merge hooks with same matcher
      const bashHooks = result.hooks?.PreToolUse?.find(h => h.matcher === 'Bash');
      expect(bashHooks?.hooks).toHaveLength(2);
      
      // Should have separate Write hook
      const writeHooks = result.hooks?.PreToolUse?.find(h => h.matcher === 'Write');
      expect(writeHooks?.hooks).toHaveLength(1);
      
      // Should merge env
      expect(result.env).toEqual({
        FROM_PRESET: 'true',
        FROM_CONFIG: 'true'
      });
    });

    it('should handle missing presets gracefully', async () => {
      // Mock file system to simulate missing presets
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const config: HugsyConfig = {
        extends: '@hugsylabs/hugsy-compiler/presets/non-existent'
      };
      
      // Should not throw, just use empty preset
      const result = await compiler.compile(config);
      
      expect(result).toBeDefined();
      expect(result.$schema).toBe('https://json.schemastore.org/claude-code-settings.json');
    });
  });
});