import { motion } from 'framer-motion';
import {
  FileCode,
  Package,
  Puzzle,
  Terminal,
  Settings,
  Github,
  BookOpen,
  MessageCircle
} from 'lucide-react';
import useStore from '../store';
import { cn } from '../utils/cn';

const menuItems = [
  { id: 'editor' as const, label: 'Configuration', icon: FileCode },
  { id: 'presets' as const, label: 'Presets', icon: Package },
  { id: 'plugins' as const, label: 'Plugins', icon: Puzzle },
  { id: 'logs' as const, label: 'Execution Logs', icon: Terminal },
];

export function Sidebar() {
  const { activeTab, setActiveTab, logs } = useStore();
  
  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <motion.button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-hugsy-100 dark:bg-hugsy-900/20 text-hugsy-700 dark:text-hugsy-400"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                )}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                
                {/* Badge for logs */}
                {item.id === 'logs' && (errorCount > 0 || warnCount > 0) && (
                  <div className="flex items-center space-x-1">
                    {errorCount > 0 && (
                      <span className="px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                        {errorCount}
                      </span>
                    )}
                    {warnCount > 0 && (
                      <span className="px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full">
                        {warnCount}
                      </span>
                    )}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800">
          <h3 className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Resources
          </h3>
          <div className="mt-3 space-y-1">
            <motion.a
              href="https://github.com/HugsyLab/hugsy"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ x: 2 }}
              className="flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Github className="w-4 h-4 mr-3" />
              GitHub
            </motion.a>
            <motion.a
              href="#"
              whileHover={{ x: 2 }}
              className="flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <BookOpen className="w-4 h-4 mr-3" />
              Documentation
            </motion.a>
            <motion.a
              href="#"
              whileHover={{ x: 2 }}
              className="flex items-center px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <MessageCircle className="w-4 h-4 mr-3" />
              Community
            </motion.a>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4 mr-2 text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Settings</span>
        </motion.button>
      </div>
    </aside>
  );
}