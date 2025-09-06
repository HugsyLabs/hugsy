import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for unit testing
global.fetch = vi.fn();

describe('Server API Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API client functions', () => {
    it('should handle successful hugsyrc fetch', async () => {
      const mockResponse = {
        content: '{"extends": "@hugsylabs/hugsy-compiler/presets/development"}',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const response = await fetch('http://localhost:3001/api/hugsyrc');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBeDefined();
      expect(typeof data.content).toBe('string');
    });

    it('should handle config exists check', async () => {
      const mockResponse = { exists: true };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const response = await fetch('http://localhost:3001/api/config/exists');
      const data = await response.json();

      expect(data.exists).toBe(true);
    });

    it('should handle settings fetch', async () => {
      const mockResponse = {
        exists: true,
        settings: {
          permissions: {
            allow: ['Read(**)', 'Write(**/test/**)'],
          },
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const response = await fetch('http://localhost:3001/api/settings');
      const data = await response.json();

      expect(data.exists).toBe(true);
      expect(data.settings).toBeDefined();
      expect(data.settings.permissions).toBeDefined();
    });

    it('should handle packages list', async () => {
      const mockResponse = {
        packages: [
          {
            name: '@hugsylabs/plugin-test',
            version: '1.0.0',
            category: 'plugin',
            isDev: false,
          },
          {
            name: 'typescript',
            version: '5.0.0',
            category: 'other',
            isDev: true,
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const response = await fetch('http://localhost:3001/api/packages');
      const data = await response.json();

      expect(Array.isArray(data.packages)).toBe(true);
      expect(data.packages).toHaveLength(2);
      expect(data.packages[0].category).toBe('plugin');
    });

    it('should handle compile request', async () => {
      const mockResponse = {
        success: true,
        output: 'Compilation successful',
        settings: { test: 'settings' },
        commands: { test: 'command' },
        subagents: { test: 'agent' },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const response = await fetch('http://localhost:3001/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.settings).toBeDefined();
      expect(data.commands).toBeDefined();
      expect(data.subagents).toBeDefined();
    });

    it('should handle API errors', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal Server Error' }),
      } as Response);

      const response = await fetch('http://localhost:3001/api/compile', {
        method: 'POST',
      });
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal Server Error');
    });

    it('should handle network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      await expect(fetch('http://localhost:3001/api/hugsyrc')).rejects.toThrow('Network error');
    });

    it('should handle install packages request', async () => {
      const mockResponse = {
        success: true,
        message: 'Successfully installed 2 package(s)',
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const response = await fetch('http://localhost:3001/api/install-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packages: ['@hugsylabs/plugin-new', '@hugsylabs/preset-new'],
        }),
      });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toContain('Successfully installed');
    });
  });
});
