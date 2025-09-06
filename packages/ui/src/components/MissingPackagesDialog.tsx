import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Package, Terminal, X, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';

interface MissingPackagesDialogProps {
  isOpen: boolean;
  packages: string[];
  onInstall: () => Promise<void>;
  onSkip: () => void;
  onCancel: () => void;
}

export function MissingPackagesDialog({
  isOpen,
  packages,
  onInstall,
  onSkip,
  onCancel,
}: MissingPackagesDialogProps) {
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await onInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  // Detect package manager
  const packageManager = 'pnpm'; // You could detect this from package.json

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onCancel}
          />

          {/* Dialog */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Missing Packages Detected
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {packages.length} package{packages.length !== 1 ? 's' : ''} need to be
                        installed
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onCancel}
                    disabled={isInstalling}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-4">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      The following packages are referenced in your configuration but not installed:
                    </p>

                    {/* Package List */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                      {packages.map((pkg) => (
                        <div key={pkg} className="flex items-center space-x-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <code className="text-sm font-mono text-gray-700 dark:text-gray-300">
                            {pkg}
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Installation Command */}
                  <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <Terminal className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-400">Install command:</span>
                    </div>
                    <code className="text-sm font-mono text-green-400 select-all">
                      {packageManager} add {packages.join(' ')}
                    </code>
                  </div>

                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    You can try to install these packages automatically, or copy the command above
                    and run it manually in your terminal.
                  </p>

                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Note:</strong> If automatic installation fails, please run the command
                      manually in your terminal.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={onSkip}
                    disabled={isInstalling}
                    className={cn(
                      'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                      'text-gray-700 dark:text-gray-300',
                      'bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600',
                      'hover:bg-gray-50 dark:hover:bg-gray-800',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    Skip for Now
                  </button>
                  <button
                    onClick={() => void handleInstall()}
                    disabled={isInstalling}
                    className={cn(
                      'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                      'bg-primary-600 hover:bg-primary-700 text-white',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'flex items-center space-x-2'
                    )}
                  >
                    {isInstalling ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Installing...</span>
                      </>
                    ) : (
                      <>
                        <Package className="w-4 h-4" />
                        <span>Install Packages</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
