/**
 * Logger plugin example (TypeScript version)
 * Adds logging for all tool usage
 */
const loggerPlugin = {
    name: 'logger-plugin',
    description: 'Log all tool usage for audit purposes',
    transform(config) {
        // Add logging environment variable
        config.env = config.env || {};
        config.env.LOG_LEVEL = 'debug';
        config.env.AUDIT_TOOLS = 'true';
        // Add logging hooks for different tool events
        config.hooks = config.hooks || {};
        // Log when tools are used
        config.hooks['PreToolUse'] = config.hooks['PreToolUse'] || [];
        config.hooks['PreToolUse'].push({
            matcher: 'Write(**)',
            command: 'echo "[AUDIT] Write operation attempted"'
        });
        config.hooks['PreToolUse'].push({
            matcher: 'Bash(*)',
            command: 'echo "[AUDIT] Bash command executed"'
        });
        // Add permission to write to log files
        config.permissions = config.permissions || {};
        config.permissions.allow = config.permissions.allow || [];
        config.permissions.allow.push('Write(**/logs/*.log)');
        return config;
    }
};
export default loggerPlugin;
