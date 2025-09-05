import { motion } from 'framer-motion';
import { Package, Check, Star, Shield, Code, Zap } from 'lucide-react';
import useStore from '../store';
import { cn } from '../utils/cn';

const presetIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  '@hugsy/recommended': Star,
  '@hugsy/strict': Shield,
  '@hugsy/development': Code,
  '@hugsy/showcase': Zap,
};

export function PresetManager() {
  const { config, availablePresets, loadPreset } = useStore();
  const currentPreset = config.extends;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 h-[60px] flex items-center">
        <div className="flex items-center justify-between w-full">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Preset Manager</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Start with a pre-configured template for your project
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Current: <span className="font-medium text-gray-700 dark:text-gray-300">{currentPreset ?? 'None'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availablePresets.map((preset) => {
            const Icon = presetIcons[preset.name] ?? Package;
            const isActive = currentPreset === preset.name;
            
            return (
              <motion.div
                key={preset.name}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => loadPreset(preset.name)}
                className={cn(
                  "relative p-4 rounded-xl border-2 cursor-pointer transition-all",
                  isActive
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg"
                    : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700"
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </motion.div>
                )}

                {/* Icon */}
                <div className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center mb-3",
                  isActive
                    ? "bg-primary-100 dark:bg-primary-800/30"
                    : "bg-gray-100 dark:bg-gray-800"
                )}>
                  <Icon className={cn(
                    "w-6 h-6",
                    isActive
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-gray-600 dark:text-gray-400"
                  )} />
                </div>

                {/* Content */}
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  {preset.name.replace('@hugsy/', '')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {preset.description}
                </p>

                {/* Features */}
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex flex-wrap gap-1">
                    {getPresetFeatures(preset.name).map((feature, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Custom Preset Section */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Custom Presets
          </h3>
          <div className="bg-white dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Create your own preset configuration
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Create Custom Preset
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getPresetFeatures(presetName: string): string[] {
  const features: Record<string, string[]> = {
    '@hugsy/recommended': ['Balanced Security', 'Developer Friendly', 'Git Support'],
    '@hugsy/strict': ['Maximum Security', 'Minimal Permissions', 'Production Ready'],
    '@hugsy/development': ['Flexible Permissions', 'Debug Tools', 'Fast Iteration'],
    '@hugsy/showcase': ['All Features', 'Demo Ready', 'Examples Included'],
  };
  
  return features[presetName] || [];
}