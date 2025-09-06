import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectConfig } from '../src/utils/project-config.js';
import * as fs from 'fs';
import { join } from 'path';

// Mock modules
vi.mock('fs');
vi.mock('../src/utils/logger.js');

// Mock dynamic imports - yaml module returns default export
vi.mock('yaml', () => ({
  parse: vi.fn(() => ({ preset: 'recommended' })),
}));

describe('ProjectConfig', () => {
  const mockCwd = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('find', () => {
    it('should find .hugsyrc.json', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === join(mockCwd, '.hugsyrc.json');
      });

      expect(ProjectConfig.find()).toBe(join(mockCwd, '.hugsyrc.json'));
    });

    it('should find .hugsyrc.yml', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === join(mockCwd, '.hugsyrc.yml');
      });

      expect(ProjectConfig.find()).toBe(join(mockCwd, '.hugsyrc.yml'));
    });

    it('should find hugsy.config.js', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === join(mockCwd, 'hugsy.config.js');
      });

      expect(ProjectConfig.find()).toBe(join(mockCwd, 'hugsy.config.js'));
    });

    it('should find config in package.json', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === join(mockCwd, 'package.json');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ hugsy: { preset: 'recommended' } })
      );

      expect(ProjectConfig.find()).toBe(join(mockCwd, 'package.json'));
    });

    it('should return null if no config found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(ProjectConfig.find()).toBeNull();
    });

    it('should use custom directory', () => {
      const customDir = '/custom/dir';
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === join(customDir, '.hugsyrc.json');
      });

      expect(ProjectConfig.find(customDir)).toBe(join(customDir, '.hugsyrc.json'));
    });

    it('should handle invalid package.json', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === join(mockCwd, 'package.json');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      expect(ProjectConfig.find()).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true if config exists', () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === join(mockCwd, '.hugsyrc.json');
      });

      expect(ProjectConfig.exists()).toBe(true);
    });

    it('should return false if no config', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(ProjectConfig.exists()).toBe(false);
    });
  });

  describe('read', () => {
    it('should read JSON config', async () => {
      const config = { preset: 'recommended' };
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === join(mockCwd, '.hugsyrc.json');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

      const result = await ProjectConfig.read();
      expect(result).toEqual(config);
    });

    it('should read config from package.json', async () => {
      const config = { preset: 'strict' };
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === join(mockCwd, 'package.json');
      });
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ hugsy: config }));

      const result = await ProjectConfig.read();
      expect(result).toEqual(config);
    });

    it('should return null if no config', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = await ProjectConfig.read();
      expect(result).toBeNull();
    });

    it('should handle read errors', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === join(mockCwd, '.hugsyrc.json');
      });
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = await ProjectConfig.read();
      expect(result).toBeNull();
    });

    it('should read YAML config', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === join(mockCwd, '.hugsyrc.yml');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('preset: recommended');

      const result = await ProjectConfig.read();
      expect(result).toEqual({ preset: 'recommended' });
    });

    it('should handle invalid JSON array config', async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === join(mockCwd, '.hugsyrc.json');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('[]');

      const result = await ProjectConfig.read();
      expect(result).toBeNull();
    });
  });

  describe('write', () => {
    it('should write JSON config with default dir', () => {
      const config = { preset: 'recommended' };
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      expect(ProjectConfig.write(config)).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        join(mockCwd, '.hugsyrc.json'),
        JSON.stringify(config, null, 2)
      );
    });

    it('should write JSON config with custom dir', () => {
      const config = { preset: 'recommended' };
      const customDir = '/custom/dir';
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      expect(ProjectConfig.write(config, customDir)).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        join(customDir, '.hugsyrc.json'),
        JSON.stringify(config, null, 2)
      );
    });

    it('should return false on write error', () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write error');
      });

      expect(ProjectConfig.write({})).toBe(false);
    });
  });
});
