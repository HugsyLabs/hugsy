import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { api } from '../../src/services/api';

// Mock fetch globally
global.fetch = vi.fn() as MockedFunction<typeof fetch>;

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHugsyrc', () => {
    it('should fetch hugsyrc content', async () => {
      const mockContent = '{"extends": "@hugsy/recommended"}';
      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve({ content: mockContent }),
      } as Response);

      const result = await api.getHugsyrc();

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/hugsyrc');
      expect(result).toBe(mockContent);
    });
  });

  describe('updateHugsyrc', () => {
    it('should update hugsyrc content', async () => {
      const newContent = '{"extends": "@hugsy/strict"}';
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
      } as Response);

      await api.updateHugsyrc(newContent);

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/hugsyrc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      });
    });
  });

  describe('compile', () => {
    it('should compile settings', async () => {
      const mockResponse = {
        settings: { $schema: 'test' },
        output: 'Compilation successful',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await api.compile();

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getCommands', () => {
    it('should fetch commands', async () => {
      const mockCommands = {
        commands: [
          {
            name: 'test-folder',
            files: [
              {
                name: 'test.md',
                path: '/test/test.md',
                content: 'Test content',
              },
            ],
          },
        ],
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve(mockCommands),
      } as Response);

      const result = await api.getCommands();

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/commands');
      expect(result).toEqual(mockCommands);
    });
  });

  describe('updateCommand', () => {
    it('should update a command', async () => {
      const path = '/test/command.md';
      const content = 'Updated content';
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
      } as Response);

      await api.updateCommand(path, content);

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
      });
    });
  });

  describe('deleteCommand', () => {
    it('should delete a command', async () => {
      const path = '/test/command.md';
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
      } as Response);

      await api.deleteCommand(path);

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/commands', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
    });
  });

  describe('installSettings', () => {
    it('should install settings without force', async () => {
      const mockResponse = {
        settings: { $schema: 'test' },
        output: 'Installation successful',
        message: 'Settings installed',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await api.installSettings();

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should install settings with force', async () => {
      const mockResponse = {
        settings: { $schema: 'test' },
        output: 'Installation successful',
        message: 'Settings installed (forced)',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await api.installSettings(true);

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when install fails', async () => {
      const errorMessage = 'Installation failed';
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: errorMessage }),
      } as Response);

      await expect(api.installSettings()).rejects.toThrow(errorMessage);
    });
  });

  describe('checkConfigExists', () => {
    it('should check if config exists', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve({ exists: true }),
      } as Response);

      const result = await api.checkConfigExists();

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/config/exists');
      expect(result).toBe(true);
    });
  });

  describe('getPresets', () => {
    it('should fetch available presets', async () => {
      const mockPresets = [
        { name: 'recommended', description: 'Recommended settings' },
        { name: 'strict', description: 'Strict security settings' },
      ];
      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve({ presets: mockPresets }),
      } as Response);

      const result = await api.getPresets();

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/presets');
      expect(result).toEqual(mockPresets);
    });
  });

  describe('initConfig', () => {
    it('should initialize config with preset', async () => {
      const mockResponse = {
        success: true,
        config: { $schema: 'test' },
        message: 'Config initialized',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await api.initConfig('recommended');

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: 'recommended', force: false }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should initialize config with force option', async () => {
      const mockResponse = {
        success: true,
        config: { $schema: 'test' },
        message: 'Config initialized (forced)',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await api.initConfig('strict', true);

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: 'strict', force: true }),
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getSettings', () => {
    it('should fetch existing settings', async () => {
      const mockResponse = {
        settings: { $schema: 'test', permissions: {} },
        exists: true,
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await api.getSettings();

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/settings');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('installPackages', () => {
    it('should install packages successfully', async () => {
      const mockResponse = {
        success: true,
        message: 'Packages installed',
        output: 'Installation output',
        packageManager: 'npm',
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await api.installPackages(['@hugsylabs/plugin-test']);

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/install-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages: ['@hugsylabs/plugin-test'] }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when package installation fails', async () => {
      const errorMessage = 'Package not found';
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: errorMessage }),
      } as Response);

      await expect(api.installPackages(['invalid-package'])).rejects.toThrow(errorMessage);
    });

    it('should use default error message when error is not provided', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      } as Response);

      await expect(api.installPackages(['invalid-package'])).rejects.toThrow(
        'Failed to install packages'
      );
    });
  });

  describe('getAgents', () => {
    it('should fetch agents', async () => {
      const mockAgents = {
        agents: {
          'test-agent': {
            name: 'Test Agent',
            description: 'A test agent',
            tools: ['Read', 'Write'],
            content: 'Agent content',
          },
        },
      };
      vi.mocked(global.fetch).mockResolvedValueOnce({
        json: () => Promise.resolve(mockAgents),
      } as Response);

      const result = await api.getAgents();

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/agents');
      expect(result).toEqual(mockAgents);
    });
  });
});
