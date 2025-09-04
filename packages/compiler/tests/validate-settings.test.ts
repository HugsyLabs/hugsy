/**
 * 独立的 validateSettings 方法单元测试
 * 测试 settings.json 格式验证的所有场景
 */

import { describe, it, expect } from 'vitest';
import { Compiler } from '../src/index';
import type { ClaudeSettings } from '@hugsylabs/hugsy-types';

describe('validateSettings Method', () => {
  let compiler: Compiler;
  
  beforeEach(() => {
    compiler = new Compiler({ projectRoot: '/test/project' });
  });

  describe('Schema Validation', () => {
    it('应该检测缺失的 $schema 字段', () => {
      const settings: ClaudeSettings = {
        permissions: { allow: ['Read(**)'] }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Missing required $schema field');
    });

    it('应该检测错误的 $schema 值', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://wrong.schema.com',
        permissions: { allow: ['Read(**)'] }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Invalid $schema value, must be https://json.schemastore.org/claude-code-settings.json');
    });

    it('应该接受正确的 $schema 值', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: { allow: ['Read(**)'] }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).not.toContain('Missing required $schema field');
      expect(errors).not.toContain('Invalid $schema value');
    });
  });

  describe('Permission Validation', () => {
    it('应该验证权限格式必须以大写字母开头', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: {
          allow: ['read(**)', 'Write(**)']
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Invalid permission format in allow: "read(**)". Must match Tool or Tool(pattern)');
      expect(errors).not.toContain('Invalid permission format in allow: "Write(**)". Must match Tool or Tool(pattern)');
    });

    it('应该验证权限格式不能以数字开头', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: {
          deny: ['123Delete', 'Delete(*)']
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Invalid permission format in deny: "123Delete". Must match Tool or Tool(pattern)');
      expect(errors).not.toContain('Invalid permission format in deny: "Delete(*)". Must match Tool or Tool(pattern)');
    });

    it('应该接受有效的权限格式', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: {
          allow: ['Read(**)', 'Write(**/*.ts)', 'Edit'],
          ask: ['Bash(git push *)', 'Delete(**/*.js)'],
          deny: ['Bash(rm -rf /)', 'Sudo']
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors.filter(e => e.includes('Invalid permission format'))).toEqual([]);
    });
  });

  describe('Hooks Validation', () => {
    it('应该检测缺失的 matcher 字段', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              hooks: [
                { type: 'command', command: 'echo "test"', timeout: 1000 }
              ]
            } as any
          ]
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Hooks.PreToolUse[0] missing required \'matcher\' field');
    });

    it('应该检测 matcher 中包含参数的错误格式', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash(git *)',
              hooks: [
                { type: 'command', command: 'echo "test"', timeout: 1000 }
              ]
            }
          ]
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Hooks.PreToolUse[0].matcher "Bash(git *)" should be tool name only (e.g., "Bash" not "Bash(git *)")');
    });

    it('应该检测缺失的 hooks 数组', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write'
            } as any
          ]
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Hooks.PostToolUse[0] missing required \'hooks\' array');
    });

    it('应该检测 hooks 不是数组的情况', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: {
            matcher: 'Bash',
            hooks: []
          } as any
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Hooks.PreToolUse must be an array');
    });

    it('应该检测缺失的 type 字段', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                { command: 'echo "test"', timeout: 1000 } as any
              ]
            }
          ]
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Hooks.PreToolUse[0].hooks[0] missing required \'type\' field');
    });

    it('应该检测错误的 type 值', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                { type: 'script' as any, command: 'echo "test"', timeout: 1000 }
              ]
            }
          ]
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Hooks.PreToolUse[0].hooks[0].type must be "command", got "script"');
    });

    it('应该检测缺失的 command 字段', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [
                { type: 'command', timeout: 1000 } as any
              ]
            }
          ]
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Hooks.PostToolUse[0].hooks[0] missing required \'command\' field');
    });

    it('应该检测非数字的 timeout 值', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                { type: 'command', command: 'echo "test"', timeout: '1000' as any }
              ]
            }
          ]
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Hooks.PreToolUse[0].hooks[0].timeout must be a number');
    });

    it('应该接受正确的 hooks 格式', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                { type: 'command', command: 'echo "test"', timeout: 1000 }
              ]
            },
            {
              matcher: 'Write',
              hooks: [
                { type: 'command', command: 'prettier --write' },
                { type: 'command', command: 'eslint --fix', timeout: 5000 }
              ]
            }
          ],
          PostToolUse: [
            {
              matcher: '*',
              hooks: [
                { type: 'command', command: 'echo "done"' }
              ]
            }
          ]
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors.filter(e => e.includes('Hooks.'))).toEqual([]);
    });
  });

  describe('Environment Variables Validation', () => {
    it('应该检测非字符串的环境变量值', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        env: {
          NODE_ENV: 'development',
          PORT: 3000 as any,
          DEBUG: true as any,
          CONFIG: { nested: 'value' } as any
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('Environment variable \'PORT\' must be a string, got number');
      expect(errors).toContain('Environment variable \'DEBUG\' must be a string, got boolean');
      expect(errors).toContain('Environment variable \'CONFIG\' must be a string, got object');
      expect(errors).not.toContain('Environment variable \'NODE_ENV\' must be a string');
    });

    it('应该接受所有字符串值的环境变量', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        env: {
          NODE_ENV: 'development',
          PORT: '3000',
          DEBUG: 'true',
          CONFIG: JSON.stringify({ nested: 'value' })
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors.filter(e => e.includes('Environment variable'))).toEqual([]);
    });
  });

  describe('StatusLine Validation', () => {
    it('应该检测无效的 statusLine.type', () => {
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

    it('应该检测 command 类型缺失 command 字段', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: {
          type: 'command'
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('statusLine.command is required when type is "command"');
    });

    it('应该检测 static 类型缺失 value 字段', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: {
          type: 'static'
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('statusLine.value is required when type is "static"');
    });

    it('应该接受有效的 command 类型 statusLine', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: {
          type: 'command',
          command: 'git status --short'
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors.filter(e => e.includes('statusLine'))).toEqual([]);
    });

    it('应该接受有效的 static 类型 statusLine', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        statusLine: {
          type: 'static',
          value: 'Hugsy Project'
        }
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors.filter(e => e.includes('statusLine'))).toEqual([]);
    });
  });

  describe('Optional Fields Validation', () => {
    it('应该检测非数字的 cleanupPeriodDays', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        cleanupPeriodDays: '7' as any
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('cleanupPeriodDays must be a number, got string');
    });

    it('应该检测非布尔值的 includeCoAuthoredBy', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        includeCoAuthoredBy: 'true' as any
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('includeCoAuthoredBy must be a boolean, got string');
    });

    it('应该检测非布尔值的 enableAllProjectMcpServers', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        enableAllProjectMcpServers: 1 as any
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('enableAllProjectMcpServers must be a boolean, got number');
    });

    it('应该检测非数组的 enabledMcpjsonServers', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        enabledMcpjsonServers: 'server1' as any
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('enabledMcpjsonServers must be an array');
    });

    it('应该检测非数组的 disabledMcpjsonServers', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        disabledMcpjsonServers: { server: 'disabled' } as any
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toContain('disabledMcpjsonServers must be an array');
    });

    it('应该接受有效的可选字段', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        cleanupPeriodDays: 7,
        includeCoAuthoredBy: true,
        enableAllProjectMcpServers: false,
        enabledMcpjsonServers: ['server1', 'server2'],
        disabledMcpjsonServers: ['server3']
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toEqual([]);
    });
  });

  describe('Complete Valid Settings', () => {
    it('应该对完全有效的配置返回空错误数组', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json',
        permissions: {
          allow: ['Read(**)', 'Write(**/*.ts)', 'Edit(**/*.js)'],
          ask: ['Bash(git push *)', 'Delete(**/node_modules)'],
          deny: ['Bash(rm -rf /)', 'Bash(sudo *)']
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                { type: 'command', command: 'echo "Starting bash"', timeout: 1000 }
              ]
            }
          ],
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [
                { type: 'command', command: 'prettier --write' },
                { type: 'command', command: 'eslint --fix', timeout: 5000 }
              ]
            }
          ]
        },
        env: {
          NODE_ENV: 'development',
          PROJECT: 'hugsy',
          DEBUG: 'false'
        },
        statusLine: {
          type: 'static',
          value: 'Hugsy Compiler'
        },
        model: 'claude-3-opus',
        cleanupPeriodDays: 14,
        includeCoAuthoredBy: false,
        enableAllProjectMcpServers: true,
        enabledMcpjsonServers: ['typescript-language-server'],
        disabledMcpjsonServers: [],
        apiKeyHelper: 'get-api-key.sh',
        awsAuthRefresh: 'refresh-aws.sh',
        awsCredentialExport: 'export-creds.sh'
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toEqual([]);
    });

    it('应该对最小有效配置返回空错误数组', () => {
      const settings: ClaudeSettings = {
        $schema: 'https://json.schemastore.org/claude-code-settings.json'
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors).toEqual([]);
    });
  });

  describe('Multiple Errors Detection', () => {
    it('应该能同时检测多个错误', () => {
      const settings: ClaudeSettings = {
        // Missing $schema
        permissions: {
          allow: ['invalid-format', 'Read(**)'],
          deny: ['123Invalid']
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash(git *)', // Wrong format
              hooks: [
                { type: 'script' as any, command: 'test' } // Wrong type
              ]
            }
          ]
        },
        env: {
          PORT: 3000 as any // Wrong type
        },
        statusLine: {
          type: 'command' // Missing command field
        },
        cleanupPeriodDays: '7' as any, // Wrong type
        includeCoAuthoredBy: 'yes' as any // Wrong type
      };
      
      const errors = compiler.validateSettings(settings);
      
      expect(errors.length).toBeGreaterThan(5);
      expect(errors).toContain('Missing required $schema field');
      expect(errors.some(e => e.includes('invalid-format'))).toBe(true);
      expect(errors.some(e => e.includes('123Invalid'))).toBe(true);
      expect(errors.some(e => e.includes('Bash(git *)'))).toBe(true);
      expect(errors.some(e => e.includes('script'))).toBe(true);
      expect(errors.some(e => e.includes('PORT'))).toBe(true);
      expect(errors.some(e => e.includes('statusLine.command'))).toBe(true);
      expect(errors.some(e => e.includes('cleanupPeriodDays'))).toBe(true);
      expect(errors.some(e => e.includes('includeCoAuthoredBy'))).toBe(true);
    });
  });
});