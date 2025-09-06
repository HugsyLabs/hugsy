/**
 * Type definitions for Hugsy
 */

// Claude Code Settings types
export interface ClaudeSettings {
  $schema?: string;
  permissions?: PermissionSettings;
  hooks?: HookSettings;
  env?: Record<string, string>;
  model?: string;
  apiKeyHelper?: string;
  cleanupPeriodDays?: number;
  includeCoAuthoredBy?: boolean;
  statusLine?: StatusLineConfig;
  forceLoginMethod?: 'claudeai' | 'console';
  forceLoginOrgUUID?: string;
  enableAllProjectMcpServers?: boolean;
  enabledMcpjsonServers?: string[];
  disabledMcpjsonServers?: string[];
  awsAuthRefresh?: string;
  awsCredentialExport?: string;
}

export interface PermissionSettings {
  allow: string[];
  ask: string[];
  deny: string[];
}

export type HookSettings = Record<string, HookConfig | HookConfig[]>;

export interface HookConfig {
  matcher?: string;
  hooks?: {
    type: 'command';
    command: string;
    timeout?: number;
  }[];
  command?: string;
  timeout?: number;
}

export interface StatusLineConfig {
  type: 'command' | 'static';
  command?: string;
  value?: string; // For static type
  text?: string; // Deprecated, kept for backward compatibility
}

// Slash Commands types
export interface SlashCommand {
  content: string; // Command content (markdown)
  description?: string; // Command description
  category?: string; // Category (affects directory structure)
  argumentHint?: string; // Hint for arguments (e.g., "[issue-number]")
  model?: string; // Override model for this command
  allowedTools?: string[]; // Restrict tools for this command
}

export interface SlashCommandsConfig {
  presets?: string[]; // Referenced command packages
  files?: string[]; // Local file glob patterns
  commands?: Record<string, string | SlashCommand>; // Direct definitions
}

// Subagents types
export interface Subagent {
  name: string; // Subagent identifier
  description: string; // When this subagent should be invoked
  tools?: string[]; // Specific tools (inherits all if omitted)
  content: string; // System prompt (markdown)
}

export interface SubagentsConfig {
  presets?: string[]; // Referenced subagent packages
  files?: string[]; // Local file glob patterns
  agents?: Record<string, string | Subagent>; // Direct definitions
}

// Hugsy Configuration types
export interface HugsyConfig {
  // Inheritance and plugins
  extends?: string | string[];
  plugins?: string[];

  // Permission configuration
  permissions?: {
    allow?: string[];
    ask?: string[];
    deny?: string[];
    [key: string]: string[] | undefined;
  };

  // Hook configuration
  hooks?: HookSettings;

  // Environment variables
  env?: Record<string, string>;

  // Slash commands configuration
  commands?: SlashCommandsConfig | string[]; // Support shorthand

  // Subagents configuration
  subagents?: SubagentsConfig | string[]; // Support shorthand

  // Claude settings passthrough
  model?: string;
  apiKeyHelper?: string;
  cleanupPeriodDays?: number;
  includeCoAuthoredBy?: boolean;
  statusLine?: StatusLineConfig;
  forceLoginMethod?: 'claudeai' | 'console';
  forceLoginOrgUUID?: string;
  enableAllProjectMcpServers?: boolean;
  enabledMcpjsonServers?: string[];
  disabledMcpjsonServers?: string[];
  awsAuthRefresh?: string;
  awsCredentialExport?: string;

  // Hugsy-specific
  ignore?: string[];
}

// Plugin and Preset types
export interface Plugin {
  name?: string;
  version?: string;
  permissions?: {
    allow?: string[];
    ask?: string[];
    deny?: string[];
  };
  hooks?: HookSettings;
  env?: Record<string, string>;
  commands?: Record<string, string | SlashCommand>; // Plugin can provide commands
  transform?: (config: HugsyConfig) => HugsyConfig | Promise<HugsyConfig>;
  validate?: (config: HugsyConfig) => string[]; // Validate the final config and return errors
}

export interface Preset extends Plugin {
  // Presets are essentially plugins that are used via 'extends'
  description?: string;
}

// Hook types
export type HookType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Notification'
  | 'UserPromptSubmit'
  | 'Stop'
  | 'SubagentStop'
  | 'SessionEnd'
  | 'PreCompact'
  | 'SessionStart';

export interface HookInput {
  tool_name?: string;
  tool_input?: unknown;
  tool_response?: {
    success: boolean;
    output?: string;
    error?: string;
  };
  session_id: string;
  cwd: string;
  transcript_path?: string;
  timestamp?: number;
  success?: boolean;
  duration_ms?: number;
  prompt?: string; // For UserPromptSubmit
  message?: string; // For AssistantMessage
}

export interface HookOutput {
  allow?: boolean;
  message?: string;
  continue?: boolean;
  warnings?: string[];
  modified_prompt?: string; // For UserPromptSubmit
  modified_message?: string; // For AssistantMessage
}

// CLI types
export interface CLIOptions {
  version?: boolean;
  help?: boolean;
  debug?: boolean;
  config?: string;
}

export interface InitOptions extends CLIOptions {
  force?: boolean;
  global?: boolean;
  project?: boolean;
}
