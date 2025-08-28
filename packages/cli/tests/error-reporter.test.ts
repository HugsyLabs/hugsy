import { describe, it, expect } from 'vitest';
import { ErrorReporter, ErrorCode } from '../src/utils/error-reporter';
import type { HugsyError } from '../src/utils/error-reporter';

describe('ErrorReporter', () => {
  describe('format', () => {
    it('should format basic error', () => {
      const error: HugsyError = {
        code: ErrorCode.CONFIG_VALIDATION,
        message: 'Invalid configuration',
      };

      const formatted = ErrorReporter.format(error);
      
      expect(formatted).toContain('⚠️ Configuration Error');
      expect(formatted).toContain('Invalid configuration');
    });

    it('should include details when provided', () => {
      const error: HugsyError = {
        code: ErrorCode.PLUGIN_LOAD_ERROR,
        message: 'Plugin failed to load',
        details: 'Module not found\nSyntax error on line 5',
      };

      const formatted = ErrorReporter.format(error);
      
      expect(formatted).toContain('Details:');
      expect(formatted).toContain('Module not found');
      expect(formatted).toContain('Syntax error on line 5');
    });

    it('should include context when provided', () => {
      const error: HugsyError = {
        code: ErrorCode.FILE_WRITE_ERROR,
        message: 'Cannot write file',
        context: {
          filePath: '/test/file.json',
          errorCode: 'EACCES',
        },
      };

      const formatted = ErrorReporter.format(error);
      
      expect(formatted).toContain('Context:');
      expect(formatted).toContain('filePath: /test/file.json');
      expect(formatted).toContain('errorCode: EACCES');
    });

    it('should include suggestion when provided', () => {
      const error: HugsyError = {
        code: ErrorCode.INVALID_PERMISSION,
        message: 'Invalid permission',
        suggestion: 'Use format: Tool(pattern)\nExample: Read(**)',
      };

      const formatted = ErrorReporter.format(error);
      
      expect(formatted).toContain('💡 How to fix:');
      expect(formatted).toContain('Use format: Tool(pattern)');
      expect(formatted).toContain('Example: Read(**)');
    });

    it('should format complete error with all fields', () => {
      const error: HugsyError = {
        code: ErrorCode.CIRCULAR_DEPENDENCY,
        message: 'Circular dependency found',
        details: 'preset-a -> preset-b -> preset-a',
        suggestion: 'Remove one of the extends references',
        context: {
          cycleLength: 2,
          involvedPresets: 'preset-a, preset-b',
        },
      };

      const formatted = ErrorReporter.format(error);
      
      expect(formatted).toContain('🔄 Circular Dependency Error');
      expect(formatted).toContain('Circular dependency found');
      expect(formatted).toContain('Details:');
      expect(formatted).toContain('preset-a -> preset-b -> preset-a');
      expect(formatted).toContain('Context:');
      expect(formatted).toContain('cycleLength: 2');
      expect(formatted).toContain('💡 How to fix:');
      expect(formatted).toContain('Remove one of the extends references');
    });
  });

  describe('circularDependency', () => {
    it('should create circular dependency error', () => {
      const cycle = ['preset-a', 'preset-b', 'preset-c', 'preset-a'];
      const error = ErrorReporter.circularDependency(cycle);
      
      expect(error.code).toBe(ErrorCode.CIRCULAR_DEPENDENCY);
      expect(error.message).toContain('preset-a -> preset-b -> preset-c -> preset-a');
      expect(error.suggestion).toContain('Remove the extends reference from "preset-c" to "preset-a"');
      expect(error.context?.cycleLength).toBe(3);
    });

    it('should handle self-reference', () => {
      const cycle = ['preset-a', 'preset-a'];
      const error = ErrorReporter.circularDependency(cycle);
      
      expect(error.message).toContain('preset-a -> preset-a');
      expect(error.suggestion).toContain('Remove the extends reference from "preset-a" to "preset-a"');
      expect(error.context?.cycleLength).toBe(1);
    });
  });

  describe('invalidPermission', () => {
    it('should create invalid permission error', () => {
      const error = ErrorReporter.invalidPermission('read(**)', 'Tool name must start with uppercase');
      
      expect(error.code).toBe(ErrorCode.INVALID_PERMISSION);
      expect(error.message).toContain('Invalid permission format: "read(**)"');
      expect(error.details).toBe('Tool name must start with uppercase');
      expect(error.suggestion).toContain('Tool names start with uppercase letter');
      expect(error.suggestion).toContain('Examples:');
      expect(error.context?.invalidValue).toBe('read(**)');
    });
  });

  describe('pluginLoadError', () => {
    it('should create plugin load error for local path', () => {
      const pluginError = new Error('Cannot find module');
      const error = ErrorReporter.pluginLoadError('./my-plugin.js', pluginError);
      
      expect(error.code).toBe(ErrorCode.PLUGIN_LOAD_ERROR);
      expect(error.message).toContain('Failed to load plugin: ./my-plugin.js');
      expect(error.details).toBe('Cannot find module');
      expect(error.suggestion).toContain('Check that the file exists');
      expect(error.suggestion).toContain('Verify the file path is correct');
      expect(error.context?.pluginPath).toBe('./my-plugin.js');
    });

    it('should create plugin load error for npm package', () => {
      const pluginError = new Error('Module not installed');
      const error = ErrorReporter.pluginLoadError('hugsy-plugin-test', pluginError);
      
      expect(error.message).toContain('Failed to load plugin: hugsy-plugin-test');
      expect(error.suggestion).toContain('npm install hugsy-plugin-test');
      expect(error.suggestion).toContain('Check package.json dependencies');
    });
  });

  describe('presetNotFound', () => {
    it('should handle built-in preset', () => {
      const error = ErrorReporter.presetNotFound('@hugsy/unknown');
      
      expect(error.code).toBe(ErrorCode.PRESET_NOT_FOUND);
      expect(error.message).toContain('Preset not found: @hugsy/unknown');
      expect(error.suggestion).toContain('Available built-in presets:');
      expect(error.suggestion).toContain('@hugsy/recommended');
      expect(error.context?.type).toBe('builtin');
    });

    it('should handle local preset', () => {
      const error = ErrorReporter.presetNotFound('./presets/custom.json');
      
      expect(error.message).toContain('Preset not found: ./presets/custom.json');
      expect(error.suggestion).toContain('Check that the file exists');
      expect(error.suggestion).toContain('relative to your project root');
      expect(error.context?.type).toBe('local');
    });

    it('should handle npm preset', () => {
      const error = ErrorReporter.presetNotFound('hugsy-preset-custom');
      
      expect(error.message).toContain('Preset not found: hugsy-preset-custom');
      expect(error.suggestion).toContain('npm install hugsy-preset-custom');
      expect(error.context?.type).toBe('npm');
    });
  });

  describe('configValidation', () => {
    it('should create config validation error with known field', () => {
      const error = ErrorReporter.configValidation('extends', 'Expected string or array, got number');
      
      expect(error.code).toBe(ErrorCode.CONFIG_VALIDATION);
      expect(error.message).toContain('Configuration validation failed for field: extends');
      expect(error.details).toBe('Expected string or array, got number');
      expect(error.suggestion).toContain('string or array of preset names');
      expect(error.context?.field).toBe('extends');
    });

    it('should handle unknown field', () => {
      const error = ErrorReporter.configValidation('customField', 'Unknown field');
      
      expect(error.message).toContain('Configuration validation failed for field: customField');
      expect(error.suggestion).toContain('Check the documentation');
    });
  });

  describe('fileWriteError', () => {
    it('should handle permission error', () => {
      const fsError = new Error('EACCES: permission denied');
      const error = ErrorReporter.fileWriteError('/etc/config.json', fsError);
      
      expect(error.code).toBe(ErrorCode.FILE_WRITE_ERROR);
      expect(error.message).toContain('Failed to write file: /etc/config.json');
      expect(error.suggestion).toContain('Permission denied');
      expect(error.suggestion).toContain('Running with appropriate permissions');
      expect(error.context?.filePath).toBe('/etc/config.json');
    });

    it('should handle directory not exist error', () => {
      const fsError = new Error('ENOENT: no such file or directory');
      const error = ErrorReporter.fileWriteError('/missing/dir/file.json', fsError);
      
      expect(error.message).toContain('Failed to write file: /missing/dir/file.json');
      expect(error.suggestion).toContain('Directory doesn\'t exist');
      expect(error.suggestion).toContain('parent directory will be created automatically');
    });

    it('should handle generic error', () => {
      const fsError = new Error('Disk full');
      const error = ErrorReporter.fileWriteError('/tmp/file.json', fsError);
      
      expect(error.message).toContain('Failed to write file: /tmp/file.json');
      expect(error.suggestion).toContain('Check file system permissions and disk space');
    });
  });

  describe('hookExecutionError', () => {
    it('should create hook execution error', () => {
      const execError = new Error('Command failed with exit code 1');
      const error = ErrorReporter.hookExecutionError('PreToolUse', 'npm test', execError);
      
      expect(error.code).toBe(ErrorCode.HOOK_EXECUTION_ERROR);
      expect(error.message).toContain('Hook execution failed: PreToolUse');
      expect(error.details).toContain('Command: npm test');
      expect(error.details).toContain('Error: Command failed with exit code 1');
      expect(error.suggestion).toContain('Check that the command is valid');
      expect(error.suggestion).toContain('Try running the command manually');
      expect(error.context?.hookType).toBe('PreToolUse');
      expect(error.context?.command).toBe('npm test');
    });
  });

  describe('error formatting edge cases', () => {
    it('should handle empty context', () => {
      const error: HugsyError = {
        code: ErrorCode.CONFIG_VALIDATION,
        message: 'Test error',
        context: {},
      };

      const formatted = ErrorReporter.format(error);
      
      expect(formatted).not.toContain('Context:');
    });

    it('should handle multiline suggestions', () => {
      const error: HugsyError = {
        code: ErrorCode.PLUGIN_LOAD_ERROR,
        message: 'Error',
        suggestion: 'Line 1\nLine 2\nLine 3',
      };

      const formatted = ErrorReporter.format(error);
      const lines = formatted.split('\n');
      
      const suggestionIndex = lines.findIndex(l => l.includes('💡 How to fix:'));
      expect(lines[suggestionIndex + 1]).toContain('  Line 1');
      expect(lines[suggestionIndex + 2]).toContain('  Line 2');
      expect(lines[suggestionIndex + 3]).toContain('  Line 3');
    });

    it('should handle error with no optional fields', () => {
      const error: HugsyError = {
        code: ErrorCode.PRESET_NOT_FOUND,
        message: 'Simple error message',
      };

      const formatted = ErrorReporter.format(error);
      
      expect(formatted).toContain('📦 Preset Not Found');
      expect(formatted).toContain('Simple error message');
      expect(formatted).not.toContain('Details:');
      expect(formatted).not.toContain('Context:');
      expect(formatted).not.toContain('💡 How to fix:');
    });
  });
});