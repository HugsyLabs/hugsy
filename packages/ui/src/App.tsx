import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfigEditor } from './components/ConfigEditor';
import { LogViewer } from './components/LogViewer';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { PresetManager } from './components/PresetManager';
import { PluginManager } from './components/PluginManager';
import useStore from './store';

function App() {
  const { activeTab, theme } = useStore();

  useEffect(() => {
    // Apply theme
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const renderContent = () => {
    switch (activeTab) {
      case 'editor':
        return <ConfigEditor />;
      case 'presets':
        return <PresetManager />;
      case 'plugins':
        return <PluginManager />;
      case 'logs':
        return <LogViewer fullScreen />;
      default:
        return <ConfigEditor />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-[0.015] dark:opacity-[0.02] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative flex h-screen">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header />

          {/* Content Area with Animation */}
          <main className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Status Bar */}
          <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-2">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-4">
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                  Ready
                </span>
                <span>Hugsy v0.1.0</span>
              </div>
              <div className="flex items-center space-x-4">
                <span>UTF-8</span>
                <span>TypeScript React</span>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Log Panel (when not in logs tab) */}
        {activeTab !== 'logs' && (
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            className="w-96 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
          >
            <LogViewer />
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default App;