import { motion } from 'framer-motion';
import { 
  Moon, 
  Sun, 
  Play, 
  Download,
  Upload,
  RotateCcw
} from 'lucide-react';
import useStore from '../store';
import { cn } from '../utils/cn';

export function Header() {
  const { 
    theme, 
    setTheme, 
    compile, 
    isCompiling, 
    compiledSettings,
    editorLayout,
    toggleEditorLayout 
  } = useStore();

  const handleExport = () => {
    if (compiledSettings) {
      const blob = new Blob([JSON.stringify(compiledSettings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'settings.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const themeIcons = {
    light: Sun,
    dark: Moon,
  };

  const Icon = themeIcons[theme];

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-end px-6 py-3">
        <div className="flex items-center space-x-2">
          {/* Layout Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleEditorLayout}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title={`Switch to ${editorLayout === 'horizontal' ? 'vertical' : 'horizontal'} layout`}
          >
            <RotateCcw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </motion.button>

          {/* Import Config */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Import configuration"
          >
            <Upload className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </motion.button>

          {/* Export Settings */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExport}
            disabled={!compiledSettings}
            className={cn(
              "p-2 rounded-lg transition-colors",
              compiledSettings 
                ? "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                : "bg-gray-50 dark:bg-gray-900 opacity-50 cursor-not-allowed"
            )}
            title="Export compiled settings"
          >
            <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </motion.button>

          {/* Compile Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => void compile()}
            disabled={isCompiling}
            className={cn(
              "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all",
              isCompiling
                ? "bg-primary-300 dark:bg-primary-700 cursor-wait"
                : "bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg"
            )}
          >
            {isCompiling ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>{isCompiling ? 'Compiling...' : 'Compile'}</span>
          </motion.button>

          {/* Theme Switcher */}
          <div className="relative ml-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const themes: ('light' | 'dark')[] = ['light', 'dark'];
                const currentIndex = themes.indexOf(theme);
                const nextIndex = (currentIndex + 1) % themes.length;
                setTheme(themes[nextIndex]);
              }}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Toggle theme"
            >
              <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  );
}