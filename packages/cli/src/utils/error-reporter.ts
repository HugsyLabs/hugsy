/**
 * Error reporter for user-friendly error messages
 */

export enum ErrorCode {
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  INVALID_PERMISSION = 'INVALID_PERMISSION',
  PLUGIN_LOAD_ERROR = 'PLUGIN_LOAD_ERROR',
  PRESET_NOT_FOUND = 'PRESET_NOT_FOUND',
  CONFIG_VALIDATION = 'CONFIG_VALIDATION',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  HOOK_EXECUTION_ERROR = 'HOOK_EXECUTION_ERROR',
}

export interface HugsyError {
  code: ErrorCode;
  message: string;
  details?: string;
  suggestion?: string;
  context?: Record<string, string | number | boolean>;
}

export class ErrorReporter {
  /**
   * Format error for display
   */
  static format(error: HugsyError): string {
    const lines: string[] = [];
    
    // Error header with emoji based on type
    const emoji = this.getErrorEmoji(error.code);
    lines.push(`${emoji} ${this.getErrorTitle(error.code)}`);
    lines.push('');
    
    // Main error message
    lines.push(error.message);
    
    // Additional details if provided
    if (error.details) {
      lines.push('');
      lines.push('Details:');
      const detailLines = error.details.split('\n');
      detailLines.forEach(line => {
        lines.push(`  ${line}`);
      });
    }
    
    // Context information
    if (error.context && Object.keys(error.context).length > 0) {
      lines.push('');
      lines.push('Context:');
      for (const [key, value] of Object.entries(error.context)) {
        lines.push(`  ${key}: ${value}`);
      }
    }
    
    // Suggestion for fixing
    if (error.suggestion) {
      lines.push('');
      lines.push('💡 How to fix:');
      const suggestionLines = error.suggestion.split('\n');
      suggestionLines.forEach(line => {
        lines.push(`  ${line}`);
      });
    }
    
    return lines.join('\n');
  }

  /**
   * Create a circular dependency error
   */
  static circularDependency(cycle: string[]): HugsyError {
    return {
      code: ErrorCode.CIRCULAR_DEPENDENCY,
      message: `Circular dependency detected: ${cycle.join(' -> ')}`,
      details: 'Your configuration has presets that depend on each other in a circular way.',
      suggestion: `Remove the extends reference from "${cycle[cycle.length - 2]}" to "${cycle[cycle.length - 1]}"
Or restructure your presets to avoid circular dependencies.`,
      context: {
        cycleLength: cycle.length - 1,
        involvedPresets: cycle.slice(0, -1).join(', ')
      }
    };
  }

  /**
   * Create an invalid permission error
   */
  static invalidPermission(permission: string, reason: string): HugsyError {
    return {
      code: ErrorCode.INVALID_PERMISSION,
      message: `Invalid permission format: "${permission}"`,
      details: reason,
      suggestion: `Permissions must match the pattern: Tool or Tool(pattern)
Examples:
  - Read(**)
  - Write(**/test/**)
  - Bash(npm test)
  
Make sure:
  - Tool names start with uppercase letter
  - Patterns are properly enclosed in parentheses
  - No spaces between Tool and parentheses`,
      context: {
        invalidValue: permission
      }
    };
  }

  /**
   * Create a plugin load error
   */
  static pluginLoadError(pluginPath: string, error: Error): HugsyError {
    const isLocalPath = pluginPath.startsWith('./') || pluginPath.startsWith('../');
    
    return {
      code: ErrorCode.PLUGIN_LOAD_ERROR,
      message: `Failed to load plugin: ${pluginPath}`,
      details: error.message,
      suggestion: isLocalPath 
        ? `Check that the file exists and exports a valid plugin object:
  - Verify the file path is correct
  - Ensure the file exports a default object or named export
  - Check for syntax errors in the plugin file`
        : `Ensure the npm package is installed:
  - Run: npm install ${pluginPath}
  - Check package.json dependencies`,
      context: {
        pluginPath,
        errorType: error.name
      }
    };
  }

  /**
   * Create a preset not found error
   */
  static presetNotFound(presetName: string): HugsyError {
    const isBuiltin = presetName.startsWith('@hugsy/');
    const isLocal = presetName.startsWith('./') || presetName.startsWith('../');
    
    let suggestion = '';
    if (isBuiltin) {
      suggestion = `Built-in preset "${presetName}" not found.
Available built-in presets:
  - @hugsy/recommended
  - @hugsy/minimal
  - @hugsy/strict`;
    } else if (isLocal) {
      suggestion = `Check that the file exists at the specified path.
The path is relative to your project root.`;
    } else {
      suggestion = `Install the preset package:
  npm install ${presetName}`;
    }
    
    return {
      code: ErrorCode.PRESET_NOT_FOUND,
      message: `Preset not found: ${presetName}`,
      suggestion,
      context: {
        presetName,
        type: isBuiltin ? 'builtin' : isLocal ? 'local' : 'npm'
      }
    };
  }

  /**
   * Create a config validation error
   */
  static configValidation(field: string, issue: string): HugsyError {
    const suggestions: Record<string, string> = {
      extends: 'The extends field should be a string or array of preset names.',
      permissions: 'Permissions should have allow, deny, or ask arrays with valid patterns.',
      plugins: 'Plugins should be an array of plugin paths or package names.',
      env: 'Environment variables should be an object with string keys and values.',
      hooks: 'Hooks should follow the Claude Code hook configuration format.',
      commands: 'Commands can be an object, array of presets, or command configuration.',
    };
    
    return {
      code: ErrorCode.CONFIG_VALIDATION,
      message: `Configuration validation failed for field: ${field}`,
      details: issue,
      suggestion: suggestions[field] || 'Check the documentation for valid configuration options.',
      context: {
        field,
        validationType: 'schema'
      }
    };
  }

  /**
   * Create a file write error
   */
  static fileWriteError(filePath: string, error: Error): HugsyError {
    const isPermission = error.message.includes('EACCES') || error.message.includes('permission');
    const isDirNotExist = error.message.includes('ENOENT');
    
    let suggestion = 'Check file system permissions and disk space.';
    if (isPermission) {
      suggestion = `Permission denied. Try:
  - Running with appropriate permissions
  - Checking file ownership
  - Ensuring the directory is writable`;
    } else if (isDirNotExist) {
      suggestion = `Directory doesn't exist. The parent directory will be created automatically.
If this persists, check the path is correct.`;
    }
    
    return {
      code: ErrorCode.FILE_WRITE_ERROR,
      message: `Failed to write file: ${filePath}`,
      details: error.message,
      suggestion,
      context: {
        filePath,
        errorCode: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN'
      }
    };
  }

  /**
   * Create a hook execution error
   */
  static hookExecutionError(hookType: string, command: string, error: Error): HugsyError {
    return {
      code: ErrorCode.HOOK_EXECUTION_ERROR,
      message: `Hook execution failed: ${hookType}`,
      details: `Command: ${command}\nError: ${error.message}`,
      suggestion: `Check that the command is valid and executable:
  - Verify the command exists in PATH
  - Check for syntax errors in the command
  - Ensure required dependencies are installed
  - Try running the command manually to debug`,
      context: {
        hookType,
        command,
        exitCode: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN'
      }
    };
  }

  /**
   * Get emoji for error type
   */
  private static getErrorEmoji(code: ErrorCode): string {
    const emojis: Record<ErrorCode, string> = {
      [ErrorCode.CIRCULAR_DEPENDENCY]: '🔄',
      [ErrorCode.INVALID_PERMISSION]: '🚫',
      [ErrorCode.PLUGIN_LOAD_ERROR]: '🔌',
      [ErrorCode.PRESET_NOT_FOUND]: '📦',
      [ErrorCode.CONFIG_VALIDATION]: '⚠️',
      [ErrorCode.FILE_WRITE_ERROR]: '💾',
      [ErrorCode.HOOK_EXECUTION_ERROR]: '🪝',
    };
    
    return emojis[code] ?? '❌';
  }

  /**
   * Get title for error type
   */
  private static getErrorTitle(code: ErrorCode): string {
    const titles: Record<ErrorCode, string> = {
      [ErrorCode.CIRCULAR_DEPENDENCY]: 'Circular Dependency Error',
      [ErrorCode.INVALID_PERMISSION]: 'Invalid Permission Format',
      [ErrorCode.PLUGIN_LOAD_ERROR]: 'Plugin Load Error',
      [ErrorCode.PRESET_NOT_FOUND]: 'Preset Not Found',
      [ErrorCode.CONFIG_VALIDATION]: 'Configuration Error',
      [ErrorCode.FILE_WRITE_ERROR]: 'File Write Error',
      [ErrorCode.HOOK_EXECUTION_ERROR]: 'Hook Execution Failed',
    };
    
    return titles[code] ?? 'Error';
  }
}