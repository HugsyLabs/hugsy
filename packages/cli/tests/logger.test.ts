import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../src/utils/logger.js';

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('log methods', () => {
    it('should log info messages', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      logger.info('Test info message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log success messages', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      logger.success('Test success message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log warning messages', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      logger.warn('Test warning message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log error messages', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      logger.error('Test error message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log debug messages when HUGSY_DEBUG is set', () => {
      const originalEnv = process.env.HUGSY_DEBUG;
      process.env.HUGSY_DEBUG = 'true';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      logger.debug('Test debug message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
      process.env.HUGSY_DEBUG = originalEnv;
    });

    it('should not log debug messages when HUGSY_DEBUG is not set', () => {
      const originalEnv = process.env.HUGSY_DEBUG;
      delete process.env.HUGSY_DEBUG;
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      logger.debug('Test debug message');

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
      process.env.HUGSY_DEBUG = originalEnv;
    });
  });

  describe('formatting', () => {
    it('should format log messages with prefix', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      logger.info('Test message');

      expect(consoleSpy).toHaveBeenCalledWith(expect.anything(), 'Test message');
      consoleSpy.mockRestore();
    });
  });

  describe('other logger methods', () => {
    it('should log section headers', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      logger.section('Test Section');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log items', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      logger.item('Test item');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log items with values', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      logger.item('Key', 'Value');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log dividers', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      logger.divider();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should create spinner', () => {
      const spinner = logger.spinner('Loading...');

      expect(spinner).toBeDefined();
      expect(spinner.text).toBe('Loading...');
    });

    it('should draw a box', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      logger.box('Test content\nMultiple lines');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
