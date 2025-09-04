import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Terminal, 
  Trash2, 
  Info, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle,
  ChevronRight
} from 'lucide-react';
import useStore from '../store';
import { cn } from '../utils/cn';

interface LogViewerProps {
  fullScreen?: boolean;
}

export function LogViewer({ fullScreen = false }: LogViewerProps) {
  const { logs, logFilter, setLogFilter, clearLogs } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new logs are added
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter(log => 
    logFilter === 'all' || log.level === logFilter
  );

  const levelIcons = {
    info: Info,
    warn: AlertTriangle,
    error: AlertCircle,
    success: CheckCircle,
  };

  const levelColors = {
    info: 'text-blue-600 dark:text-blue-400',
    warn: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
    success: 'text-green-600 dark:text-green-400',
  };

  const filters: Array<{ value: typeof logFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'info', label: 'Info' },
    { value: 'warn', label: 'Warnings' },
    { value: 'error', label: 'Errors' },
    { value: 'success', label: 'Success' },
  ];

  return (
    <div className={cn(
      "flex flex-col bg-gray-900 dark:bg-black",
      fullScreen ? "h-full" : "h-full"
    )}>
      {/* Header */}
      <div className="bg-gray-800 dark:bg-gray-950 px-4 py-3 border-b border-gray-700 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">Execution Logs</span>
            <span className="text-xs text-gray-500">({filteredLogs.length} entries)</span>
          </div>
          <div className="flex items-center space-x-2">
            {/* Filter Buttons */}
            <div className="flex items-center bg-gray-900 dark:bg-black rounded-lg p-0.5">
              {filters.map((filter) => (
                <motion.button
                  key={filter.value}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setLogFilter(filter.value)}
                  className={cn(
                    "px-2 py-1 text-xs rounded-md transition-colors",
                    logFilter === filter.value
                      ? "bg-hugsy-600 text-white"
                      : "text-gray-400 hover:text-gray-200"
                  )}
                >
                  {filter.label}
                </motion.button>
              ))}
            </div>
            
            {/* Clear Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={clearLogs}
              className="p-1.5 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors"
              title="Clear logs"
            >
              <Trash2 className="w-4 h-4 text-gray-400" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Log Content */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No logs to display</p>
            <p className="text-xs mt-1">Logs will appear here when you compile</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredLogs.map((log) => {
              const Icon = levelIcons[log.level];
              const colorClass = levelColors[log.level];
              
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "flex items-start space-x-2 py-1 px-2 rounded hover:bg-gray-800/50 dark:hover:bg-gray-900/50 group"
                  )}
                >
                  {/* Timestamp */}
                  <span className="text-gray-600 dark:text-gray-500 whitespace-nowrap">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  
                  {/* Level Icon */}
                  <Icon className={cn("w-3 h-3 mt-0.5 flex-shrink-0", colorClass)} />
                  
                  {/* Message */}
                  <span className="flex-1 text-gray-300 dark:text-gray-400 break-all">
                    {log.message}
                  </span>
                  
                  {/* Details indicator */}
                  {log.details && (
                    <ChevronRight className="w-3 h-3 mt-0.5 text-gray-600 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-gray-800 dark:bg-gray-950 px-4 py-2 border-t border-gray-700 dark:border-gray-800">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-4 text-gray-500">
            <span className="flex items-center">
              <span className={cn(
                "w-2 h-2 rounded-full mr-1.5",
                logs.length > 0 ? "bg-green-500 animate-pulse" : "bg-gray-600"
              )}></span>
              {logs.length > 0 ? 'Active' : 'Idle'}
            </span>
            <span>UTF-8</span>
          </div>
          <div className="flex items-center space-x-3 text-gray-500">
            {logs.filter(l => l.level === 'error').length > 0 && (
              <span className="text-red-400">
                {logs.filter(l => l.level === 'error').length} errors
              </span>
            )}
            {logs.filter(l => l.level === 'warn').length > 0 && (
              <span className="text-yellow-400">
                {logs.filter(l => l.level === 'warn').length} warnings
              </span>
            )}
            <span>Terminal</span>
          </div>
        </div>
      </div>
    </div>
  );
}