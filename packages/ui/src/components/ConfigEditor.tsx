import { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { motion } from 'framer-motion';
import { FileJson, Code, AlertCircle, CheckCircle } from 'lucide-react';
import useStore from '../store';
import { cn } from '../utils/cn';

export function ConfigEditor() {
  const { config, setConfig, compiledSettings, compilationError, editorLayout } = useStore();
  const [editorError, setEditorError] = useState<string | null>(null);
  
  const configString = JSON.stringify(config, null, 2);
  const settingsString = compiledSettings ? JSON.stringify(compiledSettings, null, 2) : '// Click "Compile" to generate settings.json';

  const handleConfigChange = useCallback((value: string | undefined) => {
    if (!value) return;
    
    try {
      const parsed = JSON.parse(value);
      setConfig(parsed);
      setEditorError(null);
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Invalid JSON');
    }
  }, [setConfig]);

  const isHorizontal = editorLayout === 'horizontal';

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Configuration Editor</h2>
            {editorError && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center space-x-2 text-red-600 dark:text-red-400"
              >
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{editorError}</span>
              </motion.div>
            )}
            {compilationError && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center space-x-2 text-red-600 dark:text-red-400"
              >
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{compilationError}</span>
              </motion.div>
            )}
            {compiledSettings && !compilationError && !editorError && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center space-x-2 text-green-600 dark:text-green-400"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Configuration compiled successfully</span>
              </motion.div>
            )}
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Layout: {isHorizontal ? 'Side by side' : 'Top/Bottom'}</span>
          </div>
        </div>
      </div>

      {/* Editors */}
      <div className={cn(
        "flex-1 flex gap-0 overflow-hidden",
        isHorizontal ? "flex-row" : "flex-col"
      )}>
        {/* Source Editor */}
        <motion.div 
          className={cn(
            "flex flex-col border-gray-200 dark:border-gray-800",
            isHorizontal ? "flex-1 border-r" : "flex-1 border-b"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileJson className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">.hugsyrc</span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Source Configuration</span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="json"
              value={configString}
              onChange={handleConfigChange}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                formatOnPaste: true,
                formatOnType: true,
              }}
            />
          </div>
        </motion.div>

        {/* Output Editor */}
        <motion.div 
          className="flex-1 flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-2 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">settings.json</span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">Compiled Output</span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="json"
              value={settingsString}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
              }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}