import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Trash2,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ChevronRight,
} from 'lucide-react';
import useStore from '../store';
import type { LogEntry } from '../store';
import { cn } from '../utils/cn';

interface LogViewerProps {
  fullScreen?: boolean;
}

type LogLevel = 'info' | 'warn' | 'error' | 'success';
type LogFilter = 'all' | LogLevel;

export function LogViewer({ fullScreen = false }: LogViewerProps) {
  const { logs, logFilter, setLogFilter, clearLogs } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new logs are added
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Explicit type: LogEntry[]
  const filteredLogs: LogEntry[] = logs.filter(
    (log: LogEntry): boolean => logFilter === 'all' || log.level === logFilter
  );

  // Explicit type: Record<LogLevel, string>
  const levelColors: Record<LogLevel, string> = {
    info: 'text-blue-600 dark:text-blue-400',
    warn: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400',
    success: 'text-green-600 dark:text-green-400',
  };

  // Explicit type: {value: LogFilter, label: string}[]
  const filters: { value: LogFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'info', label: 'Info' },
    { value: 'warn', label: 'Warnings' },
    { value: 'error', label: 'Errors' },
    { value: 'success', label: 'Success' },
  ];

  return (
    <div
      className={cn('flex flex-col bg-gray-50 dark:bg-gray-900', fullScreen ? 'h-full' : 'h-full')}
    >
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-800/50 px-4 h-[42px] flex items-center border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Execution Logs
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Filter Buttons */}
          <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-700/50 rounded-lg p-0.5">
            {filters.map((filter: { value: LogFilter; label: string }) => (
              <button
                key={filter.value}
                onClick={() => setLogFilter(filter.value)}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  logFilter === filter.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-300 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-600'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clear Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={clearLogs}
          className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Clear logs"
        >
          <Trash2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </motion.button>
      </div>

      {/* Log Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-4 font-mono text-xs space-y-1 bg-white dark:bg-gray-900"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No logs to display</p>
            <p className="text-xs mt-1">Logs will appear here when you compile</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredLogs.map((log: LogEntry) => {
              const colorClass: string = levelColors[log.level];
              const iconClass: string = cn('w-3 h-3 mt-0.5 flex-shrink-0', colorClass);

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    'flex items-start space-x-2 py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800/50 group'
                  )}
                >
                  {/* Timestamp */}
                  <span className="text-gray-600 dark:text-gray-500 whitespace-nowrap">
                    {log.timestamp.toLocaleTimeString()}
                  </span>

                  {/* Level Icon - Using ternary operator to avoid TypeScript type inference issues */}
                  {log.level === 'info' ? (
                    <Info className={iconClass} />
                  ) : log.level === 'warn' ? (
                    <AlertTriangle className={iconClass} />
                  ) : log.level === 'error' ? (
                    <AlertCircle className={iconClass} />
                  ) : log.level === 'success' ? (
                    <CheckCircle className={iconClass} />
                  ) : null}

                  {/* Message */}
                  <span className="flex-1 text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap">
                    {log.message}
                  </span>

                  {/* Details indicator */}
                  {log.details ? (
                    <ChevronRight className="w-3 h-3 mt-0.5 text-gray-600 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  ) : null}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
