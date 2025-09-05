import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Shield,
  Zap,
  Code2,
  Wrench,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api';
import useStore from '../store';
import { cn } from '../utils/cn';

interface PresetOption {
  name: string;
  description: string;
  icon: React.ReactNode;
  recommended?: boolean;
}

export function InitWizard() {
  const { addLog } = useStore();
  const [presets, setPresets] = useState<PresetOption[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('recommended');
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Load available presets
    const loadPresets = async () => {
      try {
        const availablePresets = await api.getPresets();

        // Map presets with icons
        const presetsWithIcons = availablePresets.map((preset) => {
          let icon: React.ReactNode;
          let recommended = false;

          switch (preset.name) {
            case 'recommended':
              icon = <Sparkles className="w-5 h-5" />;
              recommended = true;
              break;
            case 'security':
            case 'strict':
              icon = <Shield className="w-5 h-5" />;
              break;
            case 'permissive':
            case 'development':
              icon = <Zap className="w-5 h-5" />;
              break;
            case 'minimal':
              icon = <Code2 className="w-5 h-5" />;
              break;
            case 'custom':
              icon = <Wrench className="w-5 h-5" />;
              break;
            default:
              icon = <Code2 className="w-5 h-5" />;
          }

          return {
            ...preset,
            icon,
            recommended,
          };
        });

        setPresets(presetsWithIcons);
      } catch (err) {
        console.error('Failed to load presets:', err);
        setError('Failed to load configuration presets');
      }
    };

    void loadPresets();
  }, []);

  const handleInitialize = async () => {
    setIsInitializing(true);
    setError(null);

    try {
      addLog({ level: 'info', message: `Initializing with ${selectedPreset} preset...` });

      const result = await api.initConfig(selectedPreset, false);

      if (result.success) {
        addLog({
          level: 'success',
          message: result.message ?? 'Configuration initialized successfully!',
        });
        setSuccess(true);

        // Reload the page after a short delay to load the new config
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setError(result.error ?? 'Failed to initialize configuration');
        addLog({
          level: 'error',
          message: result.error ?? 'Failed to initialize configuration',
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      addLog({ level: 'error', message: errorMessage });
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-4xl w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4 shadow-lg"
          >
            <Sparkles className="w-8 h-8 text-white" />
          </motion.div>

          <motion.h1
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold text-gray-900 dark:text-white mb-2"
          >
            Welcome to Hugsy
          </motion.h1>

          <motion.p
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-gray-600 dark:text-gray-400"
          >
            Let's set up your configuration to get started
          </motion.p>
        </div>

        {/* Success State */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12 text-center"
            >
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Configuration Initialized!
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Reloading to apply your new configuration...
              </p>
              <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto mt-4" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        {!success && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Choose a Configuration Preset
              </h2>

              <div className="grid gap-3">
                {presets.map((preset) => (
                  <motion.div
                    key={preset.name}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedPreset(preset.name)}
                    className={cn(
                      'relative p-4 rounded-xl border-2 cursor-pointer transition-all',
                      selectedPreset === preset.name
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    {preset.recommended && (
                      <span className="absolute top-2 right-2 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded-full">
                        Recommended
                      </span>
                    )}

                    <div className="flex items-start space-x-3">
                      <div
                        className={cn(
                          'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                          selectedPreset === preset.name
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        )}
                      >
                        {preset.icon}
                      </div>

                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white capitalize">
                          {preset.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {preset.description}
                        </p>
                      </div>

                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                          selectedPreset === preset.name
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300 dark:border-gray-600'
                        )}
                      >
                        {selectedPreset === preset.name && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-2 h-2 bg-white rounded-full"
                          />
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-2"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  You can change these settings later in your .hugsyrc.json file
                </p>

                <button
                  onClick={() => void handleInitialize()}
                  disabled={isInitializing || !selectedPreset}
                  className={cn(
                    'inline-flex items-center px-4 py-2 rounded-lg font-medium transition-all',
                    'bg-gradient-to-r from-blue-500 to-purple-600 text-white',
                    'hover:from-blue-600 hover:to-purple-700',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'shadow-md hover:shadow-lg'
                  )}
                >
                  {isInitializing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      Initialize Hugsy
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
