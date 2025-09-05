import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../services/api';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: unknown;
}

interface HugsyConfig {
  extends?: string | string[];
  plugins?: string[];
  permissions?: {
    allow?: string[];
    ask?: string[];
    deny?: string[];
  };
  env?: Record<string, string>;
  commands?: unknown;
  model?: string;
  includeCoAuthoredBy?: boolean;
  cleanupPeriodDays?: number;
}

interface AppState {
  // Configuration
  config: HugsyConfig;
  compiledSettings: Record<string, unknown> | null;
  compiledCommands: Record<string, { content: string; category?: string }> | null;
  isCompiling: boolean;
  isInstalling: boolean;
  compilationError: string | null;

  // Logs
  logs: LogEntry[];
  logFilter: 'all' | 'info' | 'warn' | 'error' | 'success';

  // UI State
  activeTab: 'editor' | 'commands' | 'presets' | 'plugins' | 'logs';
  theme: 'light' | 'dark';
  editorLayout: 'horizontal' | 'vertical';
  showForceInstallDialog: boolean;

  // Presets & Plugins
  availablePresets: { name: string; description: string }[];
  availablePlugins: { name: string; description: string; installed: boolean }[];

  // Actions
  setConfig: (config: HugsyConfig) => void;
  updateConfig: (updates: Partial<HugsyConfig>) => void;
  compile: () => Promise<void>;
  installSettings: (force?: boolean) => Promise<void>;
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  setLogFilter: (filter: AppState['logFilter']) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  setTheme: (theme: AppState['theme']) => void;
  toggleEditorLayout: () => void;
  setShowForceInstallDialog: (show: boolean) => void;
  loadPreset: (presetName: string) => void;
  installPlugin: (pluginName: string) => void;
  uninstallPlugin: (pluginName: string) => void;
}

const useStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // Initial state - this should be loaded from .hugsyrc.json
      config: {
        extends: '@hugsylabs/hugsy-compiler/presets/development',
        plugins: [
          './plugins/auto-format.js',
          '@hugsylabs/plugin-node',
          '@hugsylabs/plugin-git',
          '@hugsylabs/plugin-typescript',
          '@hugsylabs/plugin-test',
        ],
        env: {
          PROJECT: 'hugsy',
        },
        commands: {
          presets: ['@hugsylabs/hugsy-compiler/presets/slash-commands-common'],
        },
      },
      compiledSettings: null,
      compiledCommands: null,
      isCompiling: false,
      isInstalling: false,
      compilationError: null,

      logs: [],
      logFilter: 'all',

      activeTab: 'editor',
      theme: 'light',
      editorLayout: 'horizontal',
      showForceInstallDialog: false,

      availablePresets: [
        { name: '@hugsy/recommended', description: 'Recommended settings for most projects' },
        { name: '@hugsy/strict', description: 'Strict security settings' },
        { name: '@hugsy/development', description: 'Development-friendly settings' },
        { name: '@hugsy/showcase', description: 'Showcase all features' },
      ],

      availablePlugins: [
        { name: 'auto-format', description: 'Auto-format code on save', installed: false },
        { name: '@hugsylabs/plugin-git', description: 'Git integration', installed: false },
        { name: '@hugsylabs/plugin-node', description: 'Node.js tools', installed: false },
        {
          name: '@hugsylabs/plugin-typescript',
          description: 'TypeScript support',
          installed: false,
        },
      ],

      // Actions
      setConfig: (config) => set({ config }),

      updateConfig: (updates) =>
        set((state) => ({
          config: { ...state.config, ...updates },
        })),

      compile: async () => {
        set({ isCompiling: true, compilationError: null });
        const { addLog } = get();

        try {
          addLog({ level: 'info', message: 'Starting compilation...' });

          const result = await api.compile();

          if (result.output) {
            result.output.split('\n').forEach((line) => {
              if (line.trim()) {
                // Parse log level from output
                if (line.includes('[ERROR]')) {
                  addLog({ level: 'error', message: line.replace('[ERROR] ', '') });
                } else if (line.includes('[WARN]')) {
                  addLog({ level: 'warn', message: line.replace('[WARN] ', '') });
                } else {
                  addLog({ level: 'info', message: line });
                }
              }
            });
          }

          // Check if compilation actually succeeded
          if (result.error) {
            set({
              compilationError: result.error,
              isCompiling: false,
            });
            addLog({ level: 'error', message: `Compilation failed: ${result.error}` });
          } else {
            set({
              compiledSettings: result.settings,
              compiledCommands: {}, // Commands are compiled separately
              isCompiling: false,
            });
            addLog({ level: 'success', message: 'Compilation completed successfully!' });

            // Commands compilation info is in the output, not in result
            // We can check commands from getCommands API later if needed
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          set({
            compilationError: errorMessage,
            isCompiling: false,
          });
          addLog({ level: 'error', message: `Compilation failed: ${errorMessage}` });
        }
      },

      installSettings: async (force = false) => {
        const { addLog } = get();

        set({ isInstalling: true });

        try {
          addLog({ level: 'info', message: `Running hugsy install${force ? ' --force' : ''}...` });

          const result = await api.installSettings(force);

          // Log the output from hugsy install
          if (result.output) {
            const needsForce =
              result.output.includes('already has .claude/settings.json') ||
              result.output.includes('Use --force to overwrite');

            result.output.split('\n').forEach((line) => {
              if (line.trim()) {
                // Parse the output to determine log level
                if (line.includes('✓') || line.includes('success')) {
                  addLog({ level: 'success', message: line });
                } else if (line.includes('✗') || line.includes('error') || line.includes('❌')) {
                  addLog({ level: 'error', message: line });
                } else if (line.includes('warning')) {
                  addLog({ level: 'warn', message: line });
                } else {
                  addLog({ level: 'info', message: line });
                }
              }
            });

            // If needs force and not using force, show dialog
            if (needsForce && !force) {
              set({ isInstalling: false, showForceInstallDialog: true });
              return;
            }
          }

          if (result.error) {
            addLog({ level: 'warn', message: result.error });
          }

          if (result.settings) {
            set({ compiledSettings: result.settings });
          }

          // After install, refresh the commands from file system
          try {
            const commandData = await api.getCommands();
            // Convert to compiled commands format
            const commands: Record<string, { content: string; category?: string }> = {};
            for (const folder of commandData.commands) {
              for (const file of folder.files) {
                const name = file.name.replace('.md', '');
                commands[name] = { content: file.content };
              }
            }
            set({ compiledCommands: commands });
          } catch {
            // Ignore error, commands refresh is optional
          }

          if (!result.output?.includes('❌')) {
            addLog({
              level: 'success',
              message: 'Installation completed!',
              details: '.claude/settings.json has been updated',
            });
          }
          set({ isInstalling: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          addLog({ level: 'error', message: `Installation failed: ${errorMessage}` });
          set({ isInstalling: false });
        }
      },

      addLog: (entry) =>
        set((state) => ({
          logs: [
            ...state.logs,
            {
              ...entry,
              id: Math.random().toString(36).substr(2, 9),
              timestamp: new Date(),
            },
          ].slice(-1000), // Keep last 1000 logs
        })),

      clearLogs: () => set({ logs: [] }),

      setLogFilter: (filter) => set({ logFilter: filter }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setTheme: (theme) => set({ theme }),

      toggleEditorLayout: () =>
        set((state) => ({
          editorLayout: state.editorLayout === 'horizontal' ? 'vertical' : 'horizontal',
        })),

      setShowForceInstallDialog: (show) => set({ showForceInstallDialog: show }),

      loadPreset: (presetName) => {
        const { addLog } = get();
        addLog({ level: 'info', message: `Loading preset: ${presetName}` });
        set((state) => ({
          config: {
            ...state.config,
            extends: presetName,
          },
        }));
      },

      installPlugin: (pluginName) => {
        const { config, addLog } = get();
        addLog({ level: 'info', message: `Installing plugin: ${pluginName}` });
        set((state) => ({
          config: {
            ...state.config,
            plugins: [...(config.plugins ?? []), pluginName],
          },
          availablePlugins: state.availablePlugins.map((p) =>
            p.name === pluginName ? { ...p, installed: true } : p
          ),
        }));
        addLog({ level: 'success', message: `Plugin installed: ${pluginName}` });
      },

      uninstallPlugin: (pluginName) => {
        const { config, addLog } = get();
        addLog({ level: 'info', message: `Uninstalling plugin: ${pluginName}` });
        set((state) => ({
          config: {
            ...state.config,
            plugins: (config.plugins ?? []).filter((p) => p !== pluginName),
          },
          availablePlugins: state.availablePlugins.map((p) =>
            p.name === pluginName ? { ...p, installed: false } : p
          ),
        }));
        addLog({ level: 'success', message: `Plugin uninstalled: ${pluginName}` });
      },
    }),
    {
      name: 'hugsy-store',
    }
  )
);

export default useStore;
