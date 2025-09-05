import { memo } from 'react';
import { Moon, Sun, Eye, Download, PanelLeftOpen, PackageCheck } from 'lucide-react';
import { cn } from '../utils/cn';

interface ConfigToolbarProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  editorLayout: 'horizontal' | 'vertical';
  toggleEditorLayout: () => void;
  isCompiling: boolean;
  isInstalling: boolean;
  compiledSettings: Record<string, unknown> | null;
  onCompile: () => void;
  onInstall: () => void;
  onViewCompiled: () => void;
  onExportConfig: () => void;
  compilationError: string | null;
}

export const ConfigToolbar = memo(function ConfigToolbar({
  theme,
  setTheme,
  editorLayout,
  toggleEditorLayout,
  isCompiling,
  isInstalling,
  compiledSettings,
  onCompile,
  onInstall,
  onViewCompiled,
  onExportConfig,
  compilationError,
}: ConfigToolbarProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 h-[60px] flex items-center">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            ) : (
              <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            )}
          </button>

          <button
            onClick={toggleEditorLayout}
            className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle layout"
          >
            <PanelLeftOpen
              className={cn(
                'w-5 h-5 text-gray-700 dark:text-gray-300 transition-transform',
                editorLayout === 'vertical' ? 'rotate-90' : ''
              )}
            />
          </button>

          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />

          <button
            onClick={onCompile}
            disabled={isCompiling}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-all',
              'bg-blue-600 hover:bg-blue-700 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isCompiling && 'animate-pulse'
            )}
          >
            {isCompiling ? 'Compiling...' : 'Compile'}
          </button>

          <button
            onClick={onViewCompiled}
            className="px-4 py-2 rounded-lg font-medium transition-all bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Eye className="w-4 h-4 inline mr-2" />
            View Compiled
          </button>

          <button
            onClick={onInstall}
            disabled={isInstalling || !compiledSettings}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-all',
              'bg-green-600 hover:bg-green-700 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isInstalling && 'animate-pulse'
            )}
          >
            <PackageCheck className="w-4 h-4 inline mr-2" />
            {isInstalling ? 'Installing...' : 'Install to .claude'}
          </button>
        </div>

        <div className="flex items-center space-x-4">
          {compilationError && (
            <span className="text-red-600 text-sm">Error during compilation</span>
          )}

          <button
            onClick={onExportConfig}
            className="px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Export configuration"
          >
            <Download className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </div>
    </div>
  );
});
