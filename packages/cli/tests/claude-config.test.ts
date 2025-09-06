import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { join } from 'path';

// Mock modules
vi.mock('fs');
vi.mock('../src/utils/logger.js');

// Mock os.homedir before importing ClaudeConfig
const mockHomedir = '/home/test';
vi.mock('os', () => ({
  homedir: vi.fn(() => mockHomedir),
}));

// Import after mocking to ensure mocks are applied
const { ClaudeConfig } = await import('../src/utils/claude-config.js');

describe('ClaudeConfig', () => {
  const claudeDir = join(mockHomedir, '.claude');
  const settingsPath = join(claudeDir, 'settings.json');
  const backupPath = join(claudeDir, 'settings.json.hugsy-backup');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exists', () => {
    it('should return true if settings file exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      expect(ClaudeConfig.exists()).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith(settingsPath);
    });

    it('should return false if settings file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(ClaudeConfig.exists()).toBe(false);
    });
  });

  describe('read', () => {
    it('should return null if settings file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(ClaudeConfig.read()).toBeNull();
    });

    it('should return parsed settings if file exists', () => {
      const mockSettings = { hooks: { PreToolUse: [] } };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSettings));

      expect(ClaudeConfig.read()).toEqual(mockSettings);
      expect(fs.readFileSync).toHaveBeenCalledWith(settingsPath, 'utf-8');
    });

    it('should return null on read error', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      expect(ClaudeConfig.read()).toBeNull();
    });
  });

  describe('write', () => {
    it('should create directory if it does not exist', () => {
      const mockSettings = { hooks: {} };
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      expect(ClaudeConfig.write(mockSettings)).toBe(true);
      expect(fs.mkdirSync).toHaveBeenCalledWith(claudeDir, { recursive: true });
    });

    it('should write settings to file', () => {
      const mockSettings = { hooks: { PreToolUse: [] } };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      expect(ClaudeConfig.write(mockSettings)).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        settingsPath,
        JSON.stringify(mockSettings, null, 2)
      );
    });

    it('should return false on write error', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write error');
      });

      expect(ClaudeConfig.write({})).toBe(false);
    });
  });

  describe('backup', () => {
    it('should backup existing settings', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('settings content');
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      expect(ClaudeConfig.backup()).toBe(true);
      expect(fs.readFileSync).toHaveBeenCalledWith(settingsPath);
      expect(fs.writeFileSync).toHaveBeenCalledWith(backupPath, 'settings content');
    });

    it('should return false if settings do not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(ClaudeConfig.backup()).toBe(false);
    });

    it('should return false on backup error', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      expect(ClaudeConfig.backup()).toBe(false);
    });
  });

  describe('restore', () => {
    it('should restore from backup if exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('backup content');
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      expect(ClaudeConfig.restore()).toBe(true);
      expect(fs.readFileSync).toHaveBeenCalledWith(backupPath);
      expect(fs.writeFileSync).toHaveBeenCalledWith(settingsPath, 'backup content');
    });

    it('should return false if backup does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(ClaudeConfig.restore()).toBe(false);
    });

    it('should return false on restore error', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      expect(ClaudeConfig.restore()).toBe(false);
    });
  });

  describe('isHugsyInstalled', () => {
    it('should return false if no settings', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(ClaudeConfig.isHugsyInstalled()).toBe(false);
    });

    it('should return false if no PreToolUse hooks', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ hooks: {} }));
      expect(ClaudeConfig.isHugsyInstalled()).toBe(false);
    });

    it('should return true if hugsy hook exists', () => {
      const settings = {
        hooks: {
          PreToolUse: [
            {
              matcher: '.*',
              hooks: [{ type: 'command', command: 'node /path/to/hugsy' }],
            },
          ],
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(settings));

      expect(ClaudeConfig.isHugsyInstalled()).toBe(true);
    });

    it('should return false if no hugsy hook', () => {
      const settings = {
        hooks: {
          PreToolUse: [
            {
              matcher: '.*',
              hooks: [{ type: 'command', command: 'node /path/to/other' }],
            },
          ],
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(settings));

      expect(ClaudeConfig.isHugsyInstalled()).toBe(false);
    });
  });

  describe('addHugsyHook', () => {
    it('should add hugsy hook to new settings', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      expect(ClaudeConfig.addHugsyHook('/path/to/hook')).toBe(true);

      const writtenSettings = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
      expect(writtenSettings.hooks.PreToolUse).toHaveLength(1);
      expect(writtenSettings.hooks.PreToolUse[0].matcher).toBe('.*');
      expect(writtenSettings.hooks.PreToolUse[0].hooks[0].command).toBe('node /path/to/hook');
    });

    it('should add to existing matcher', () => {
      const existingSettings = {
        hooks: {
          PreToolUse: [
            {
              matcher: '.*',
              hooks: [],
            },
          ],
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingSettings));
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      expect(ClaudeConfig.addHugsyHook('/path/to/hook')).toBe(true);

      const writtenSettings = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
      expect(writtenSettings.hooks.PreToolUse[0].hooks).toHaveLength(1);
    });

    it('should return true if already installed', () => {
      const settings = {
        hooks: {
          PreToolUse: [
            {
              matcher: '.*',
              hooks: [{ type: 'command', command: 'node /path/to/hugsy' }],
            },
          ],
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(settings));

      expect(ClaudeConfig.addHugsyHook('/new/path')).toBe(true);
      // Should not write since already installed
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('removeHugsyHook', () => {
    it('should remove hugsy hooks', () => {
      const settings = {
        hooks: {
          PreToolUse: [
            {
              matcher: '.*',
              hooks: [
                { type: 'command', command: 'node /path/to/hugsy' },
                { type: 'command', command: 'node /path/to/other' },
              ],
            },
          ],
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(settings));
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      expect(ClaudeConfig.removeHugsyHook()).toBe(true);

      const writtenSettings = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
      expect(writtenSettings.hooks.PreToolUse[0].hooks).toHaveLength(1);
      expect(writtenSettings.hooks.PreToolUse[0].hooks[0].command).toBe('node /path/to/other');
    });

    it('should remove empty entries', () => {
      const settings = {
        hooks: {
          PreToolUse: [
            {
              matcher: '.*',
              hooks: [{ type: 'command', command: 'node /path/to/hugsy' }],
            },
          ],
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(settings));
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      expect(ClaudeConfig.removeHugsyHook()).toBe(true);

      const writtenSettings = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);
      expect(writtenSettings.hooks.PreToolUse).toHaveLength(0);
    });

    it('should return true if no hooks', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(ClaudeConfig.removeHugsyHook()).toBe(true);
    });
  });

  describe('getHugsyHookPath', () => {
    it('should return hook path if found', () => {
      const settings = {
        hooks: {
          PreToolUse: [
            {
              matcher: '.*',
              hooks: [{ type: 'command', command: 'node /path/to/hugsy/hook.js' }],
            },
          ],
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(settings));

      expect(ClaudeConfig.getHugsyHookPath()).toBe('/path/to/hugsy/hook.js');
    });

    it('should return null if no hugsy hook', () => {
      const settings = {
        hooks: {
          PreToolUse: [
            {
              matcher: '.*',
              hooks: [{ type: 'command', command: 'node /path/to/other' }],
            },
          ],
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(settings));

      expect(ClaudeConfig.getHugsyHookPath()).toBeNull();
    });

    it('should return null if no settings', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(ClaudeConfig.getHugsyHookPath()).toBeNull();
    });

    it('should return null if malformed command', () => {
      const settings = {
        hooks: {
          PreToolUse: [
            {
              matcher: '.*',
              hooks: [{ type: 'command', command: 'hugsy' }],
            },
          ],
        },
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(settings));

      expect(ClaudeConfig.getHugsyHookPath()).toBeNull();
    });
  });
});
