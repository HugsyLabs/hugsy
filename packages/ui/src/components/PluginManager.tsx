import { motion } from 'framer-motion';
import { 
  Puzzle, 
  Download, 
  Trash2, 
  Settings, 
  CheckCircle, 
  Code,
  GitBranch,
  Terminal,
  FileCode
} from 'lucide-react';
import useStore from '../store';

const pluginIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'auto-format': Code,
  '@hugsylabs/plugin-git': GitBranch,
  '@hugsylabs/plugin-node': Terminal,
  '@hugsylabs/plugin-typescript': FileCode,
};

export function PluginManager() {
  const { availablePlugins, installPlugin, uninstallPlugin } = useStore();
  
  const installedPlugins = availablePlugins.filter(p => p.installed);
  const notInstalledPlugins = availablePlugins.filter(p => !p.installed);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 h-[60px] flex items-center">
        <div className="flex items-center justify-between w-full">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Plugin Manager</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Extend Hugsy with powerful plugins
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-sm font-medium">
              {installedPlugins.length} installed
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Installed Plugins */}
        {installedPlugins.length > 0 && (
          <>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Installed Plugins
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {installedPlugins.map((plugin) => {
                const Icon = pluginIcons[plugin.name] ?? Puzzle;
                
                return (
                  <motion.div
                    key={plugin.name}
                    whileHover={{ y: -2 }}
                    className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                        <Icon className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>

                    {/* Content */}
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {plugin.name.replace('@hugsylabs/plugin-', '')}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      {plugin.description}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex-1 flex items-center justify-center px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Settings className="w-4 h-4 mr-1.5 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Configure</span>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => uninstallPlugin(plugin.name)}
                        className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {/* Available Plugins */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Available Plugins
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notInstalledPlugins.map((plugin) => {
            const Icon = pluginIcons[plugin.name] || Puzzle;
            
            return (
              <motion.div
                key={plugin.name}
                whileHover={{ y: -2 }}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </div>
                </div>

                {/* Content */}
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {plugin.name.replace('@hugsylabs/plugin-', '')}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {plugin.description}
                </p>

                {/* Install Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => installPlugin(plugin.name)}
                  className="w-full flex items-center justify-center px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  <span className="text-sm font-medium">Install</span>
                </motion.button>
              </motion.div>
            );
          })}
        </div>

        {/* Create Plugin Section */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Create Your Own Plugin
          </h3>
          <div className="bg-white dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
            <Puzzle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Build custom plugins to extend Hugsy's functionality
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Plugin Documentation
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}