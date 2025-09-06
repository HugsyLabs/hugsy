import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Sun, Palette, Code, Terminal, Zap, Shield } from 'lucide-react';
import useStore from '../store';
import { cn } from '../utils/cn';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, setTheme } = useStore();
  const [activeTab, setActiveTab] = useState<'appearance' | 'editor' | 'compiler'>('appearance');

  const themes = [
    {
      value: 'light' as const,
      label: 'Light',
      icon: Sun,
      preview: 'bg-white border-gray-200',
    },
    {
      value: 'dark' as const,
      label: 'Dark',
      icon: Moon,
      preview: 'bg-gray-900 border-gray-700',
    },
  ];

  const tabs = [
    { id: 'appearance' as const, label: 'Appearance', icon: Palette },
    { id: 'editor' as const, label: 'Editor', icon: Code },
    { id: 'compiler' as const, label: 'Compiler', icon: Terminal },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </motion.button>
              </div>

              {/* Content */}
              <div className="flex h-[500px]">
                {/* Sidebar */}
                <div className="w-48 bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-800 p-4">
                  <nav className="space-y-1">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <motion.button
                          key={tab.id}
                          whileHover={{ x: 2 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            'w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            activeTab === tab.id
                              ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{tab.label}</span>
                        </motion.button>
                      );
                    })}
                  </nav>
                </div>

                {/* Main Content */}
                <div className="flex-1 p-6 overflow-y-auto">
                  <AnimatePresence mode="wait">
                    {activeTab === 'appearance' && (
                      <motion.div
                        key="appearance"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                            Theme
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            {themes.map((t) => {
                              const Icon = t.icon;
                              const isActive = theme === t.value;

                              return (
                                <motion.button
                                  key={t.value}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setTheme(t.value)}
                                  className={cn(
                                    'relative p-4 rounded-lg border-2 transition-all',
                                    isActive
                                      ? 'border-primary-500 shadow-lg'
                                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                  )}
                                >
                                  {isActive && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="absolute top-2 right-2 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center"
                                    >
                                      <Shield className="w-3 h-3 text-white" />
                                    </motion.div>
                                  )}

                                  <div
                                    className={cn('w-full h-20 rounded mb-3 border', t.preview)}
                                  />

                                  <div className="flex items-center justify-center space-x-2">
                                    <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                      {t.label}
                                    </span>
                                  </div>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                            Animation
                          </h3>
                          <label className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              defaultChecked
                              className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              Enable animations
                            </span>
                          </label>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'editor' && (
                      <motion.div
                        key="editor"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                            Editor Settings
                          </h3>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                                Font Size
                              </label>
                              <select className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
                                <option>12px</option>
                                <option selected>14px</option>
                                <option>16px</option>
                                <option>18px</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                                Tab Size
                              </label>
                              <select className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm">
                                <option selected>2 spaces</option>
                                <option>4 spaces</option>
                                <option>Tabs</option>
                              </select>
                            </div>

                            <label className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                defaultChecked
                                className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                Word wrap
                              </span>
                            </label>

                            <label className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                defaultChecked
                                className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                Format on paste
                              </span>
                            </label>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'compiler' && (
                      <motion.div
                        key="compiler"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                            Compiler Options
                          </h3>
                          <div className="space-y-4">
                            <label className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                defaultChecked
                                className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                Verbose logging
                              </span>
                            </label>

                            <label className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                Throw on error
                              </span>
                            </label>

                            <label className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                defaultChecked
                                className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                Auto-compile on change
                              </span>
                            </label>

                            <div>
                              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                                Compile delay (ms)
                              </label>
                              <input
                                type="number"
                                defaultValue="1000"
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                            Security
                          </h3>
                          <div className="space-y-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                            <div className="flex items-start space-x-2">
                              <Zap className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                              <div>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  Always review compiled settings before using them in production.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    Save Changes
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
