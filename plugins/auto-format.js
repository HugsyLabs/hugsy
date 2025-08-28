/**
 * Auto-format plugin for Hugsy
 * Adds formatting tools configuration
 */

export default {
  name: 'auto-format',
  
  transform(config) {
    // Ensure permissions structure exists
    config.permissions = config.permissions || {};
    config.permissions.allow = config.permissions.allow || [];
    
    // Add formatter permissions if not already present
    const formatPerms = ['Bash(prettier *)', 'Bash(eslint * --fix)'];
    formatPerms.forEach(perm => {
      if (!config.permissions.allow.includes(perm)) {
        config.permissions.allow.push(perm);
      }
    });
    
    // Add status line showing current branch
    config.statusLine = {
      type: 'command',
      command: 'git branch --show-current'
    };
    
    return config;
  }
};