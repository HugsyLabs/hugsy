import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import useStore from '../store';
import { cn } from '../utils/cn';

export function InitWizard() {
  const { addLog } = useStore();
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInitialize = async () => {
    setIsInitializing(true);
    setError(null);

    try {
      addLog({ level: 'info', message: 'Initializing configuration...' });

      const result = await api.initConfig('recommended', false);

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
        className="w-full max-w-md"
      >
        {/* Success State */}
        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
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
        ) : (
          /* Main Content */
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden p-8 text-center"
          >
            <div className="max-w-sm mx-auto">
              {/* Icon */}
              <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <span className="text-white font-bold text-3xl">H</span>
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Welcome to Hugsy
              </h1>

              {/* Description */}
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Configuration management for Claude Code
              </p>

              {/* Error message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"
                >
                  <div className="flex items-center justify-center space-x-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <p className="text-sm">{error}</p>
                  </div>
                </motion.div>
              )}

              {/* Initialize button */}
              <button
                onClick={() => void handleInitialize()}
                disabled={isInitializing}
                className={cn(
                  'w-full px-8 py-3 rounded-xl font-medium transition-all inline-flex items-center justify-center space-x-2',
                  isInitializing
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                )}
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Initializing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Initialize Hugsy</span>
                  </>
                )}
              </button>

              {/* Footer text */}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-6">
                This will create a .hugsyrc.json file with basic settings
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
