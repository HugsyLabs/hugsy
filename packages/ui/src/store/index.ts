import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { api } from '../services/api';

// Global flag to prevent duplicate loading in StrictMode
let isLoadingSettings = false;
let hasLoadedSettings = false;

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
  compiledSubagents: Record<
    string,
    { content: string; description: string; tools?: string[] }
  > | null;
  existingSettings: Record<string, unknown> | null;
  hasExistingSettings: boolean;
  isCompiling: boolean;
  isInstalling: boolean;
  compilationError: string | null;

  // History for undo/redo
  configHistory: HugsyConfig[];
  historyIndex: number;

  // Logs
  logs: LogEntry[];
  logFilter: 'all' | 'info' | 'warn' | 'error' | 'success';

  // UI State
  activeTab: 'config' | 'packages';
  theme: 'light' | 'dark';
  editorLayout: 'horizontal' | 'vertical';
  showForceInstallDialog: boolean;
  showMissingPackagesDialog: boolean;
  missingPackages: string[];

  // Actions
  setConfig: (config: HugsyConfig) => void;
  updateConfig: (updates: Partial<HugsyConfig>) => void;
  loadExistingSettings: () => Promise<void>;
  compile: () => Promise<void>;
  installSettings: (force?: boolean) => Promise<void>;
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  setLogFilter: (filter: AppState['logFilter']) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  setTheme: (theme: AppState['theme']) => void;
  toggleEditorLayout: () => void;
  setShowForceInstallDialog: (show: boolean) => void;
  setShowMissingPackagesDialog: (show: boolean) => void;
  installMissingPackages: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
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
      compiledSubagents: null,
      existingSettings: null,
      hasExistingSettings: false,
      isCompiling: false,
      isInstalling: false,
      compilationError: null,

      // History for undo/redo
      configHistory: [],
      historyIndex: -1,

      logs: [],
      logFilter: 'all',

      activeTab: 'config',
      theme: 'light',
      editorLayout: 'vertical',
      showForceInstallDialog: false,
      showMissingPackagesDialog: false,
      missingPackages: [],

      // Actions
      setConfig: (config) => {
        const { configHistory, historyIndex } = get();
        const newHistory = [...configHistory.slice(0, historyIndex + 1), config];
        set({
          config,
          configHistory: newHistory.slice(-50), // Keep last 50 history items
          historyIndex: newHistory.length - 1,
        });
      },

      updateConfig: (updates) => {
        const { config, configHistory, historyIndex } = get();
        const newConfig = { ...config, ...updates };
        const newHistory = [...configHistory.slice(0, historyIndex + 1), newConfig];
        set({
          config: newConfig,
          configHistory: newHistory.slice(-50), // Keep last 50 history items
          historyIndex: newHistory.length - 1,
        });
      },

      loadExistingSettings: async () => {
        // Skip if already loaded or loading to prevent duplicate logging in StrictMode
        if (hasLoadedSettings || isLoadingSettings) {
          return;
        }

        isLoadingSettings = true;

        try {
          const result = await api.getSettings();
          set({
            existingSettings: result.settings,
            hasExistingSettings: result.exists,
            // Set compiledSettings to show in output editor, but not trigger success message
            compiledSettings: result.settings,
          });

          if (result.exists && !hasLoadedSettings) {
            const { addLog } = get();
            addLog({
              level: 'info',
              message: 'Loaded .claude/settings.json',
            });
            hasLoadedSettings = true;
          }
        } catch (error) {
          const { addLog } = get();
          addLog({
            level: 'error',
            message: `Failed to load existing settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        } finally {
          isLoadingSettings = false;
        }
      },

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

          // Check for missing packages
          if (result.missingPackages && result.missingPackages.length > 0) {
            set({
              missingPackages: result.missingPackages,
              showMissingPackagesDialog: true,
              isCompiling: false,
            });
            addLog({
              level: 'warn',
              message: `${result.missingPackages.length} missing package(s) detected`,
            });
            return;
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
              compiledCommands: result.commands ?? {}, // Use commands from compilation result
              compiledSubagents: result.subagents ?? {}, // Use subagents from compilation result
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
          // First compile to check for missing packages
          const { addLog: logMsg } = get();
          logMsg({ level: 'info', message: 'Checking configuration...' });

          const compileResult = await api.compile();

          // Check for missing packages before installing
          if (compileResult.missingPackages && compileResult.missingPackages.length > 0) {
            set({
              missingPackages: compileResult.missingPackages,
              showMissingPackagesDialog: true,
              isInstalling: false,
            });
            logMsg({
              level: 'warn',
              message: `${compileResult.missingPackages.length} missing package(s) must be installed first`,
            });
            return;
          }

          addLog({ level: 'info', message: `Running hugsy install${force ? ' --force' : ''}...` });

          const result = await api.installSettings(force);

          // Check if installation needs force option
          const needsForce =
            (result.error &&
              (result.error.includes('already exists') || result.error.includes('Use force'))) ??
            (result.output &&
              (result.output.includes('already has .claude/settings.json') ||
                result.output.includes('Use --force to overwrite')));

          // If needs force and not using force, show dialog
          if (needsForce && !force) {
            addLog({
              level: 'warn',
              message: 'Settings file already exists. Use force option to overwrite.',
            });
            set({ isInstalling: false, showForceInstallDialog: true });
            return;
          }

          // Log the output from hugsy install
          if (result.output) {
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
          }

          if (result.error && !needsForce) {
            addLog({ level: 'error', message: result.error });
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

      setShowMissingPackagesDialog: (show) => set({ showMissingPackagesDialog: show }),

      installMissingPackages: async () => {
        const { missingPackages, addLog } = get();

        try {
          addLog({ level: 'info', message: `Installing ${missingPackages.length} package(s)...` });

          const result = await api.installPackages(missingPackages);

          if (result.success) {
            addLog({
              level: 'success',
              message: result.message ?? 'Packages installed successfully',
            });

            // Hide dialog and re-run compile
            set({ showMissingPackagesDialog: false, missingPackages: [] });

            // Re-run compile after packages are installed
            const { compile } = get();
            await compile();
          } else {
            // Show user-friendly error message
            const errorMsg = result.error ?? 'Failed to install packages';
            addLog({ level: 'error', message: errorMsg });

            // If package not found, provide helpful suggestion
            if (errorMsg.includes('not found in registry')) {
              addLog({
                level: 'info',
                message:
                  'Tip: Check if the package name is correct or if it has been published to npm',
              });
            }
          }
        } catch (error) {
          addLog({
            level: 'error',
            message: `Failed to install packages: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      },

      undo: () => {
        const { configHistory, historyIndex } = get();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          set({
            config: configHistory[newIndex],
            historyIndex: newIndex,
          });
        }
      },

      redo: () => {
        const { configHistory, historyIndex } = get();
        if (historyIndex < configHistory.length - 1) {
          const newIndex = historyIndex + 1;
          set({
            config: configHistory[newIndex],
            historyIndex: newIndex,
          });
        }
      },

      canUndo: () => {
        const { historyIndex } = get();
        return historyIndex > 0;
      },

      canRedo: () => {
        const { configHistory, historyIndex } = get();
        return historyIndex < configHistory.length - 1;
      },
    }),
    {
      name: 'hugsy-store',
    }
  )
);

export default useStore;
