import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: any;
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
  commands?: any;
  model?: string;
  includeCoAuthoredBy?: boolean;
  cleanupPeriodDays?: number;
}

interface AppState {
  // Configuration
  config: HugsyConfig;
  compiledSettings: any;
  isCompiling: boolean;
  compilationError: string | null;
  
  // Logs
  logs: LogEntry[];
  logFilter: 'all' | 'info' | 'warn' | 'error' | 'success';
  
  // UI State
  activeTab: 'editor' | 'presets' | 'plugins' | 'logs';
  theme: 'light' | 'dark' | 'system';
  editorLayout: 'horizontal' | 'vertical';
  
  // Presets & Plugins
  availablePresets: Array<{ name: string; description: string; }>;
  availablePlugins: Array<{ name: string; description: string; installed: boolean; }>;
  
  // Actions
  setConfig: (config: HugsyConfig) => void;
  updateConfig: (updates: Partial<HugsyConfig>) => void;
  compile: () => Promise<void>;
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  setLogFilter: (filter: AppState['logFilter']) => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  setTheme: (theme: AppState['theme']) => void;
  toggleEditorLayout: () => void;
  loadPreset: (presetName: string) => void;
  installPlugin: (pluginName: string) => void;
  uninstallPlugin: (pluginName: string) => void;
}

const useStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // Initial state
      config: {
        extends: '@hugsy/recommended',
        plugins: [],
        permissions: {
          allow: [],
          ask: [],
          deny: [],
        },
        env: {},
      },
      compiledSettings: null,
      isCompiling: false,
      compilationError: null,
      
      logs: [],
      logFilter: 'all',
      
      activeTab: 'editor',
      theme: 'dark',
      editorLayout: 'horizontal',
      
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
        { name: '@hugsylabs/plugin-typescript', description: 'TypeScript support', installed: false },
      ],
      
      // Actions
      setConfig: (config) => set({ config }),
      
      updateConfig: (updates) => set((state) => ({
        config: { ...state.config, ...updates }
      })),
      
      compile: async () => {
        set({ isCompiling: true, compilationError: null });
        const { config, addLog } = get();
        
        try {
          addLog({ level: 'info', message: 'Starting compilation...' });
          
          // Simulate compilation steps
          addLog({ level: 'info', message: `Loading preset: ${config.extends}` });
          
          if (config.plugins && config.plugins.length > 0) {
            addLog({ level: 'info', message: `Loading ${config.plugins.length} plugin(s): ${config.plugins.join(', ')}` });
          }
          
          // Simulate permission resolution
          const totalPerms = (config.permissions?.allow?.length || 0) +
                           (config.permissions?.ask?.length || 0) +
                           (config.permissions?.deny?.length || 0);
          
          if (totalPerms > 0) {
            addLog({ level: 'info', message: `Resolving ${totalPerms} permission(s)...` });
          }
          
          // Simulate compilation result
          const compiledSettings = {
            permissions: {
              allow: [
                ...(config.permissions?.allow || []),
                'Read(**)',
                'Write(**/test/**)',
                'Bash(git *)',
                'Bash(npm test)',
              ],
              ask: [
                ...(config.permissions?.ask || []),
                'Bash(sudo *)',
                'Bash(npm publish)',
              ],
              deny: [
                ...(config.permissions?.deny || []),
                'Write(*:*password=*)',
                'Write(*:*secret=*)',
                'Bash(rm -rf /*)',
              ],
            },
            env: {
              NODE_ENV: 'development',
              ...config.env,
            },
            model: config.model,
            includeCoAuthoredBy: config.includeCoAuthoredBy,
            cleanupPeriodDays: config.cleanupPeriodDays,
          };
          
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate async work
          
          set({ compiledSettings, isCompiling: false });
          addLog({ level: 'success', message: 'Compilation completed successfully!' });
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          set({ 
            compilationError: errorMessage,
            isCompiling: false 
          });
          addLog({ level: 'error', message: `Compilation failed: ${errorMessage}` });
        }
      },
      
      addLog: (entry) => set((state) => ({
        logs: [...state.logs, {
          ...entry,
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date(),
        }].slice(-1000) // Keep last 1000 logs
      })),
      
      clearLogs: () => set({ logs: [] }),
      
      setLogFilter: (filter) => set({ logFilter: filter }),
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      setTheme: (theme) => set({ theme }),
      
      toggleEditorLayout: () => set((state) => ({
        editorLayout: state.editorLayout === 'horizontal' ? 'vertical' : 'horizontal'
      })),
      
      loadPreset: (presetName) => {
        const { addLog } = get();
        addLog({ level: 'info', message: `Loading preset: ${presetName}` });
        set((state) => ({
          config: {
            ...state.config,
            extends: presetName,
          }
        }));
      },
      
      installPlugin: (pluginName) => {
        const { config, addLog } = get();
        addLog({ level: 'info', message: `Installing plugin: ${pluginName}` });
        set((state) => ({
          config: {
            ...state.config,
            plugins: [...(config.plugins || []), pluginName],
          },
          availablePlugins: state.availablePlugins.map(p =>
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
            plugins: (config.plugins || []).filter(p => p !== pluginName),
          },
          availablePlugins: state.availablePlugins.map(p =>
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