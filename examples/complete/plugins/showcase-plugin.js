/**
 * Showcase plugin - adds extensive hooks for demonstration (TypeScript version)
 */
const showcasePlugin = {
    name: 'showcase-plugin',
    description: 'Adds comprehensive hooks and settings for showcase',
    transform(config) {
        // Add more hooks to demonstrate all hook types
        config.hooks = config.hooks || {};
        // Add more PreToolUse hooks
        config.hooks.PreToolUse = config.hooks.PreToolUse || [];
        const preToolHooks = [
            {
                matcher: "Write(**/src/**)",
                command: "echo '📦 Source code modification detected'"
            },
            {
                matcher: "Bash(npm install *)",
                command: "echo '📦 Installing dependencies...'"
            },
            {
                matcher: "Edit(**)",
                command: "echo '✏️ File edit operation'"
            },
            {
                matcher: "MultiEdit(**)",
                command: "echo '✏️ Multiple edits in progress'"
            }
        ];
        config.hooks.PreToolUse.push(...preToolHooks);
        // Add more PostToolUse hooks
        config.hooks.PostToolUse = config.hooks.PostToolUse || [];
        const postToolHooks = [
            {
                matcher: "Bash(git commit *)",
                command: "echo '📝 Commit created successfully'"
            },
            {
                matcher: "Write(**/README.md)",
                command: "echo '📚 Documentation updated'"
            }
        ];
        config.hooks.PostToolUse.push(...postToolHooks);
        // Add more UserPromptSubmit hooks
        config.hooks.UserPromptSubmit = config.hooks.UserPromptSubmit || [];
        const userPromptHooks = [
            {
                matcher: "*refactor*",
                command: "echo '♻️ Refactoring request detected'"
            },
            {
                matcher: "*optimize*",
                command: "echo '⚡ Optimization request detected'"
            },
            {
                matcher: "*security*",
                command: "echo '🔐 Security check requested'"
            }
        ];
        config.hooks.UserPromptSubmit.push(...userPromptHooks);
        // Add Notification hooks
        config.hooks.Notification = config.hooks.Notification || [];
        const notificationHooks = [
            {
                matcher: "*success*",
                command: "echo '✨ Success notification'"
            },
            {
                matcher: "*complete*",
                command: "echo '🎉 Task completed'"
            }
        ];
        config.hooks.Notification.push(...notificationHooks);
        // Add more environment variables
        config.env = config.env || {};
        config.env.PLUGIN_VERSION = '1.0.0';
        config.env.AUDIT_MODE = 'true';
        config.env.PERFORMANCE_TRACKING = 'enabled';
        config.env.AUTO_FORMAT = 'true';
        config.env.LINT_ON_SAVE = 'true';
        // Add API helper configuration
        config.apiKeyHelper = {
            command: "echo 'sk-ant-example-key'",
            timeout: 5000
        };
        // Add more permissions
        config.permissions = config.permissions || {};
        config.permissions.allow = config.permissions.allow || [];
        const additionalPermissions = [
            'Bash(prettier *)',
            'Bash(eslint * --fix)',
            'TodoWrite(**)',
            'WebSearch(*)',
            'WebFetch(*)'
        ];
        config.permissions.allow.push(...additionalPermissions);
        return config;
    }
};
export default showcasePlugin;
