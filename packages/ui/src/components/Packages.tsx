import { useState, useEffect } from 'react';
import {
  Package,
  Trash2,
  RefreshCw,
  Loader2,
  Layers,
  Puzzle,
  Terminal,
  Bot,
  Download,
  Search,
  Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';
import useStore from '../store';

interface InstalledPackage {
  name: string;
  version: string;
  description?: string;
  category: 'preset' | 'plugin' | 'command' | 'subagent';
}

export function Packages() {
  const { addLog } = useStore();
  const [packages, setPackages] = useState<InstalledPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'preset' | 'plugin' | 'command' | 'subagent'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUninstallDialog, setShowUninstallDialog] = useState(false);
  const [packageToUninstall, setPackageToUninstall] = useState<string | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [packageToInstall, setPackageToInstall] = useState('');
  const [installing, setInstalling] = useState(false);

  const categories = [
    { id: 'all', label: 'All Packages', icon: Package, color: 'gray' },
    { id: 'preset', label: 'Presets', icon: Layers, color: 'blue' },
    { id: 'plugin', label: 'Plugins', icon: Puzzle, color: 'purple' },
    { id: 'command', label: 'Commands', icon: Terminal, color: 'green' },
    { id: 'subagent', label: 'Subagents', icon: Bot, color: 'orange' },
  ];

  useEffect(() => {
    void loadPackages();
  }, []);

  const loadPackages = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/packages');
      const data = await response.json();
      setPackages(data.packages ?? []);
      addLog({ level: 'info', message: `Loaded ${data.packages?.length ?? 0} packages` });
    } catch (error) {
      addLog({
        level: 'error',
        message: `Failed to load packages: ${error instanceof Error ? error.message : String(error)}`,
      });
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUninstallClick = (packageName: string) => {
    setPackageToUninstall(packageName);
    setShowUninstallDialog(true);
  };

  const installPackage = async () => {
    if (!packageToInstall.trim()) return;

    // Keep dialog open and show loading state
    setInstalling(true);
    addLog({ level: 'info', message: `Installing ${packageToInstall}...` });

    try {
      const response = await fetch('http://localhost:3001/api/install-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages: [packageToInstall.trim()] }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? data.details ?? 'Failed to install package');
      }

      addLog({
        level: 'success',
        message: data.message ?? `Successfully installed ${packageToInstall}`,
      });

      // Close dialog after successful installation
      setTimeout(() => {
        setShowInstallDialog(false);
        setPackageToInstall('');
        setInstalling(false);
        void loadPackages(); // Reload the list
      }, 1500); // Show success for 1.5 seconds
    } catch {
      // Simple error message without too much detail
      addLog({
        level: 'error',
        message: `Failed to install ${packageToInstall}. Please check the package name and try again.`,
      });
      // Keep dialog open on error so user can retry
      setInstalling(false);
    }
  };

  const confirmUninstall = async () => {
    if (!packageToUninstall) return;

    setShowUninstallDialog(false);
    setUninstalling(packageToUninstall);
    addLog({ level: 'info', message: `Uninstalling ${packageToUninstall}...` });

    try {
      const response = await fetch('http://localhost:3001/api/packages/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: packageToUninstall }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? data.details ?? 'Failed to uninstall package');
      }

      addLog({ level: 'success', message: `Successfully uninstalled ${packageToUninstall}` });

      // Wait a bit for the package manager to update
      setTimeout(() => {
        void loadPackages(); // Reload the list
      }, 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog({
        level: 'error',
        message: `Failed to uninstall ${packageToUninstall}: ${errorMessage}`,
      });

      // If it's a network error, provide more context
      if (errorMessage.includes('fetch')) {
        addLog({ level: 'warn', message: 'Make sure the API server is running on port 3001' });
      }
    } finally {
      setUninstalling(null);
      setPackageToUninstall(null);
    }
  };

  const filteredPackages = packages.filter((pkg) => {
    const matchesCategory = selectedCategory === 'all' || pkg.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pkg.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    return matchesCategory && matchesSearch;
  });

  const getPackagesByCategory = (category: string) => {
    return packages.filter((pkg) => pkg.category === category);
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find((c) => c.id === category);
    return cat?.icon ?? Package;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'preset':
        return 'blue';
      case 'plugin':
        return 'purple';
      case 'command':
        return 'green';
      case 'subagent':
        return 'orange';
      default:
        return 'gray';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
        <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
          Loading installed packages...
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Package Manager
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Manage your installed Hugsy packages
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => void loadPackages()}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors group"
                title="Refresh packages"
              >
                <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-primary-500 transition-colors" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowInstallDialog(true)}
                disabled={installing}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors',
                  installing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-primary-500 hover:bg-primary-600 text-white'
                )}
              >
                {installing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>{installing ? 'Installing...' : 'Install New'}</span>
              </motion.button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search packages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex space-x-1 px-4 pb-3">
          {categories.map((category) => {
            const Icon = category.icon;
            const count =
              category.id === 'all' ? packages.length : getPackagesByCategory(category.id).length;
            const isActive = selectedCategory === category.id;

            return (
              <motion.button
                key={category.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() =>
                  setSelectedCategory(
                    category.id as 'all' | 'preset' | 'plugin' | 'command' | 'subagent'
                  )
                }
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2',
                  isActive
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{category.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                      isActive
                        ? 'bg-primary-200 dark:bg-primary-800/50 text-primary-800 dark:text-primary-200'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    )}
                  >
                    {count}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Package List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredPackages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full min-h-[400px]"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-600 rounded-full blur-3xl opacity-20 animate-pulse" />
              <Filter className="w-16 h-16 text-gray-400 dark:text-gray-600 relative" />
            </div>
            <h3 className="mt-6 text-lg font-medium text-gray-900 dark:text-white">
              No packages found
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
              {searchQuery ? (
                <>
                  No packages matching "{searchQuery}" in{' '}
                  {selectedCategory === 'all' ? 'any category' : selectedCategory}
                </>
              ) : (
                <>No {selectedCategory === 'all' ? 'packages' : selectedCategory} installed yet</>
              )}
            </p>
            {searchQuery && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
              >
                Clear search
              </motion.button>
            )}
          </motion.div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filteredPackages.map((pkg, index) => {
                const Icon = getCategoryIcon(pkg.category);
                const color = getCategoryColor(pkg.category);

                return (
                  <motion.div
                    key={pkg.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -4 }}
                    className="group relative"
                  >
                    <div
                      className={cn(
                        'absolute inset-0 rounded-xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity',
                        color === 'blue' && 'bg-blue-500',
                        color === 'purple' && 'bg-purple-500',
                        color === 'green' && 'bg-green-500',
                        color === 'orange' && 'bg-orange-500',
                        color === 'gray' && 'bg-gray-500'
                      )}
                    />

                    <div className="relative p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={cn(
                            'p-2 rounded-lg',
                            color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30',
                            color === 'purple' && 'bg-purple-100 dark:bg-purple-900/30',
                            color === 'green' && 'bg-green-100 dark:bg-green-900/30',
                            color === 'orange' && 'bg-orange-100 dark:bg-orange-900/30',
                            color === 'gray' && 'bg-gray-100 dark:bg-gray-900/30'
                          )}
                        >
                          <Icon
                            className={cn(
                              'w-5 h-5',
                              color === 'blue' && 'text-blue-600 dark:text-blue-400',
                              color === 'purple' && 'text-purple-600 dark:text-purple-400',
                              color === 'green' && 'text-green-600 dark:text-green-400',
                              color === 'orange' && 'text-orange-600 dark:text-orange-400',
                              color === 'gray' && 'text-gray-600 dark:text-gray-400'
                            )}
                          />
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleUninstallClick(pkg.name)}
                          disabled={uninstalling === pkg.name}
                          className={cn(
                            'p-2 rounded-lg transition-all',
                            uninstalling === pkg.name
                              ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                              : 'opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400'
                          )}
                          title="Uninstall package"
                        >
                          {uninstalling === pkg.name ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </motion.button>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1">
                          {pkg.name.replace('@hugsylabs/', '')}
                        </h3>

                        <div className="flex items-center space-x-2">
                          <span
                            className={cn(
                              'text-xs px-2 py-1 rounded-full font-medium',
                              color === 'blue' &&
                                'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
                              color === 'purple' &&
                                'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
                              color === 'green' &&
                                'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                              color === 'orange' &&
                                'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
                              color === 'gray' &&
                                'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                            )}
                          >
                            {pkg.category}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            v{pkg.version}
                          </span>
                        </div>

                        {pkg.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                            {pkg.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Uninstall Confirmation Dialog */}
      <AnimatePresence>
        {showUninstallDialog && packageToUninstall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowUninstallDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full">
                  <Trash2 className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>

                <h3 className="text-xl font-semibold text-center text-gray-900 dark:text-white mb-2">
                  Uninstall Package
                </h3>

                <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
                  Are you sure you want to uninstall
                </p>

                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
                  <p className="text-sm font-mono text-center text-gray-900 dark:text-white break-all">
                    {packageToUninstall}
                  </p>
                </div>

                <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
                  This action will remove the package from your project and cannot be undone.
                </p>

                <div className="flex space-x-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowUninstallDialog(false)}
                    className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => void confirmUninstall()}
                    className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Uninstall</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Install Package Dialog */}
      <AnimatePresence>
        {showInstallDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowInstallDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-primary-100 dark:bg-primary-900/20 rounded-full">
                  <Download className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                </div>

                <h3 className="text-xl font-semibold text-center text-gray-900 dark:text-white mb-2">
                  {installing ? 'Installing Package...' : 'Install New Package'}
                </h3>

                <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
                  {installing
                    ? `Please wait while we install ${packageToInstall}`
                    : 'Enter the name of the Hugsy package you want to install'}
                </p>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Package Name
                  </label>
                  <input
                    type="text"
                    value={packageToInstall}
                    onChange={(e) => setPackageToInstall(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && packageToInstall.trim() && !installing) {
                        void installPackage();
                      }
                    }}
                    placeholder="@hugsylabs/plugin-example"
                    className={cn(
                      'w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all font-mono',
                      installing
                        ? 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-50'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    )}
                    disabled={installing}
                    autoFocus
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Examples: @hugsylabs/plugin-git, @hugsylabs/subagent-security-engineer
                  </p>
                </div>

                <div className="flex space-x-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowInstallDialog(false);
                      setPackageToInstall('');
                    }}
                    className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: installing ? 1 : 1.02 }}
                    whileTap={{ scale: installing ? 1 : 0.98 }}
                    onClick={() => void installPackage()}
                    disabled={!packageToInstall.trim() || installing}
                    className={cn(
                      'flex-1 px-4 py-2.5 font-medium rounded-lg transition-colors flex items-center justify-center space-x-2',
                      installing
                        ? 'bg-primary-400 text-white cursor-not-allowed'
                        : packageToInstall.trim()
                          ? 'bg-primary-600 hover:bg-primary-700 text-white'
                          : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {installing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>{installing ? 'Installing...' : 'Install'}</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
