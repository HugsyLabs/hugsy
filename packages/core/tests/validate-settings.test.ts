/**
 * Unit tests for validateSettings method
 * Tests all scenarios for settings.json format validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Compiler } from '../src/index';
import type { ClaudeSettings, HookConfig } from '@hugsylabs/hugsy-types';

describe('validateSettings Method', () => {
  let compiler: Compiler;

  beforeEach(() => {
    compiler = new Compiler({ projectRoot: '/test/project' });
  });

  describe('Schema Validation', () => {
    it('should detect missing $schema field', () => {
      const settings: ClaudeSettings = {
        permissions: { allow: ['Read(**)'], ask: [], deny: [] },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('Missing required $schema field');
    });

    it('should detect incorrect $schema value', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://wrong.schema.com',
        permissions: { allow: ['Read(**)'], ask: [], deny: [] },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain(
        'Invalid $schema value, must be https://json.schemastore.org/claude-code-settings.json'
      );
    });

    it('should accept correct $schema value', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: { allow: ['Read(**)'], ask: [], deny: [] },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).not.toContain('Missing required $schema field');
      expect(errors).not.toContain('Invalid $schema value');
    });
  });

  describe('Permission Validation', () => {
    it('should validate permission format must start with uppercase letter', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: {
          allow: ['read(**)', 'Write(**)'],
          ask: [],
          deny: [],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain(
        'Invalid permission format in allow: "read(**)". Must match Tool or Tool(pattern)'
      );
      expect(errors).not.toContain(
        'Invalid permission format in allow: "Write(**)". Must match Tool or Tool(pattern)'
      );
    });

    it('should validate permission format cannot start with number', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: {
          allow: [],
          ask: [],
          deny: ['123Delete', 'Delete(*)'],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain(
        'Invalid permission format in deny: "123Delete". Must match Tool or Tool(pattern)'
      );
      expect(errors).not.toContain(
        'Invalid permission format in deny: "Delete(*)". Must match Tool or Tool(pattern)'
      );
    });

    it('should accept valid permission formats', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: {
          allow: ['Read(**)', 'Write(**/*.ts)', 'Edit'],
          ask: ['Bash(git push *)', 'Delete(**/*.js)'],
          deny: ['Bash(rm -rf /)', 'Sudo'],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors.filter((e) => e.includes('Invalid permission format'))).toEqual([]);
    });
  });

  describe('Hooks Validation', () => {
    it('should detect missing matcher field', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              hooks: [{ type: 'command', command: 'echo "test"', timeout: 1000 }],
            } as HookConfig,
          ],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain("Hooks.PreToolUse[0] missing required 'matcher' field");
    });

    it('should detect incorrect matcher format with arguments', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash(git *)',
              hooks: [{ type: 'command', command: 'echo "test"', timeout: 1000 }],
            },
          ],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain(
        'Hooks.PreToolUse[0].matcher "Bash(git *)" should be tool name only (e.g., "Bash" not "Bash(git *)")'
      );
    });

    it('should detect missing hooks array', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write',
            } as HookConfig,
          ],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain("Hooks.PostToolUse[0] missing required 'hooks' array");
    });

    it('should detect when hooks is not an array', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: {
            matcher: 'Bash',
            hooks: [],
          } as HookConfig,
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('Hooks.PreToolUse must be an array');
    });

    it('should detect missing type field', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                { command: 'echo "test"', timeout: 1000 } as {
                  type: 'command';
                  command: string;
                  timeout: number;
                },
              ],
            },
          ],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain("Hooks.PreToolUse[0].hooks[0] missing required 'type' field");
    });

    it('should detect incorrect type value', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'script' as 'command', command: 'echo "test"', timeout: 1000 }],
            },
          ],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('Hooks.PreToolUse[0].hooks[0].type must be "command", got "script"');
    });

    it('should detect missing command field', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [
                { type: 'command', timeout: 1000 } as {
                  type: 'command';
                  command: string;
                  timeout: number;
                },
              ],
            },
          ],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain("Hooks.PostToolUse[0].hooks[0] missing required 'command' field");
    });

    it('should detect non-numeric timeout value', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo "test"', timeout: '1000' as number }],
            },
          ],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('Hooks.PreToolUse[0].hooks[0].timeout must be a number');
    });

    it('should accept valid hooks format', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo "test"', timeout: 1000 }],
            },
            {
              matcher: 'Write',
              hooks: [
                { type: 'command', command: 'prettier --write' },
                { type: 'command', command: 'eslint --fix', timeout: 5000 },
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: '*',
              hooks: [{ type: 'command', command: 'echo "done"' }],
            },
          ],
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors.filter((e) => e.includes('Hooks.'))).toEqual([]);
    });
  });

  describe('Environment Variables Validation', () => {
    it('should detect non-string environment variable values', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        env: {
          NODE_ENV: 'development',
          PORT: 3000 as string,
          DEBUG: true as string,
          CONFIG: { nested: 'value' } as string,
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain("Environment variable 'PORT' must be a string, got number");
      expect(errors).toContain("Environment variable 'DEBUG' must be a string, got boolean");
      expect(errors).toContain("Environment variable 'CONFIG' must be a string, got object");
      expect(errors).not.toContain("Environment variable 'NODE_ENV' must be a string");
    });

    it('should accept all string environment variables', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        env: {
          NODE_ENV: 'development',
          PORT: '3000',
          DEBUG: 'true',
          CONFIG: JSON.stringify({ nested: 'value' }),
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors.filter((e) => e.includes('Environment variable'))).toEqual([]);
    });
  });

  describe('StatusLine Validation', () => {
    it('should detect invalid statusLine.type', () => {
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

    it('should detect missing command field for command type', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: {
          type: 'command',
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('statusLine.command is required when type is "command"');
    });

    it('should detect missing value field for static type', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: {
          type: 'static',
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('statusLine.value is required when type is "static"');
    });

    it('should accept valid command type statusLine', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: {
          type: 'command',
          command: 'git status --short',
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors.filter((e) => e.includes('statusLine'))).toEqual([]);
    });

    it('should accept valid static type statusLine', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: {
          type: 'static',
          value: 'Hugsy Project',
        },
      };

      const errors = compiler.validateSettings(settings);

      expect(errors.filter((e) => e.includes('statusLine'))).toEqual([]);
    });
  });

  describe('Optional Fields Validation', () => {
    it('should detect non-numeric cleanupPeriodDays', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        cleanupPeriodDays: '7' as number,
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('cleanupPeriodDays must be a number, got string');
    });

    it('should detect non-boolean includeCoAuthoredBy', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        includeCoAuthoredBy: 'true' as boolean,
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('includeCoAuthoredBy must be a boolean, got string');
    });

    it('should detect non-boolean enableAllProjectMcpServers', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        enableAllProjectMcpServers: 1 as boolean,
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('enableAllProjectMcpServers must be a boolean, got number');
    });

    it('should detect non-array enabledMcpjsonServers', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        enabledMcpjsonServers: 'server1' as string[],
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('enabledMcpjsonServers must be an array');
    });

    it('should detect non-array disabledMcpjsonServers', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        disabledMcpjsonServers: { server: 'disabled' } as string[],
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toContain('disabledMcpjsonServers must be an array');
    });

    it('should accept valid optional fields', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        cleanupPeriodDays: 7,
        includeCoAuthoredBy: true,
        enableAllProjectMcpServers: false,
        enabledMcpjsonServers: ['server1', 'server2'],
        disabledMcpjsonServers: ['server3'],
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toEqual([]);
    });
  });

  describe('Complete Valid Settings', () => {
    it('should return empty error array for valid configuration', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: {
          allow: ['Read(**)', 'Write(**/*.ts)', 'Edit(**/*.js)'],
          ask: ['Bash(git push *)', 'Delete(**/node_modules)'],
          deny: ['Bash(rm -rf /)', 'Bash(sudo *)'],
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo "Starting bash"', timeout: 1000 }],
            },
          ],
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [
                { type: 'command', command: 'prettier --write' },
                { type: 'command', command: 'eslint --fix', timeout: 5000 },
              ],
            },
          ],
        },
        env: {
          NODE_ENV: 'development',
          PROJECT: 'hugsy',
          DEBUG: 'false',
        },
        statusLine: {
          type: 'static',
          value: 'Hugsy Compiler',
        },
        model: 'claude-3-opus',
        cleanupPeriodDays: 14,
        includeCoAuthoredBy: false,
        enableAllProjectMcpServers: true,
        enabledMcpjsonServers: ['typescript-language-server'],
        disabledMcpjsonServers: [],
        apiKeyHelper: 'get-api-key.sh',
        awsAuthRefresh: 'refresh-aws.sh',
        awsCredentialExport: 'export-creds.sh',
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toEqual([]);
    });

    it('should return empty error array for minimal valid configuration', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
      };

      const errors = compiler.validateSettings(settings);

      expect(errors).toEqual([]);
    });
  });

  describe('Multiple Errors Detection', () => {
    it('should detect multiple errors simultaneously', () => {
      const settings: ClaudeSettings = {
        // Missing $schema
        permissions: {
          allow: ['invalid-format', 'Read(**)'],
          deny: ['123Invalid'],
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash(git *)', // Wrong format
              hooks: [
                { type: 'script' as 'command', command: 'test' }, // Wrong type
              ],
            },
          ],
        },
        env: {
          PORT: 3000 as string, // Wrong type
        },
        statusLine: {
          type: 'command', // Missing command field
        },
        cleanupPeriodDays: '7' as number, // Wrong type
        includeCoAuthoredBy: 'yes' as boolean, // Wrong type
      };

      const errors = compiler.validateSettings(settings);

      expect(errors.length).toBeGreaterThan(5);
      expect(errors).toContain('Missing required $schema field');
      expect(errors.some((e) => e.includes('invalid-format'))).toBe(true);
      expect(errors.some((e) => e.includes('123Invalid'))).toBe(true);
      expect(errors.some((e) => e.includes('Bash(git *)'))).toBe(true);
      expect(errors.some((e) => e.includes('script'))).toBe(true);
      expect(errors.some((e) => e.includes('PORT'))).toBe(true);
      expect(errors.some((e) => e.includes('statusLine.command'))).toBe(true);
      expect(errors.some((e) => e.includes('cleanupPeriodDays'))).toBe(true);
      expect(errors.some((e) => e.includes('includeCoAuthoredBy'))).toBe(true);
    });
  });
});
