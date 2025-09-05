import { useState, useCallback, useEffect, useMemo } from 'react';
import { LazyEditor } from './LazyEditor';
import { motion } from 'framer-motion';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  FileJson,
  Code,
  AlertCircle,
  CheckCircle,
  Command,
  Sun,
  Moon,
  PanelLeftOpen,
  Download,
  Eye,
  PackageCheck,
  ChevronRight,
  Folder,
  FileText,
  X,
} from 'lucide-react';
import useStore from '../store';
import { cn } from '../utils/cn';
import { api } from '../services/api';
import { LogViewer } from './LogViewer';
import { ConfirmDialog } from './ConfirmDialog';

interface CommandFile {
  name: string;
  path: string;
  content?: string;
}

interface CommandFolder {
  name: string;
  files: CommandFile[];
  isOpen?: boolean;
}

export function ConfigEditor() {
  const {
    config,
    setConfig,
    compiledSettings,
    compiledCommands,
    compilationError,
    editorLayout,
    toggleEditorLayout,
    theme,
    setTheme,
    compile,
    isCompiling,
    installSettings,
    isInstalling,
    addLog,
    showForceInstallDialog,
    setShowForceInstallDialog,
  } = useStore();
  const [editorError, setEditorError] = useState<string | null>(null);
  const [outputTab, setOutputTab] = useState<'settings' | 'commands'>('settings');
  const [selectedCommand, setSelectedCommand] = useState<CommandFile | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['git', 'development', 'documentation', 'release'])
  );
  const [commandFolders, setCommandFolders] = useState<CommandFolder[]>([]);
  const [hugsyrcContent, setHugsyrcContent] = useState<string>('');

  // Fetch real data on mount (load both in parallel for better performance)
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load both in parallel
        const [hugsyrcContent, commandsData] = await Promise.all([
          api.getHugsyrc(),
          api.getCommands(),
        ]);

        // Set hugsyrc content
        setHugsyrcContent(hugsyrcContent);
        try {
          const parsed = JSON.parse(hugsyrcContent);
          setConfig(parsed);
        } catch (e) {
          console.error('Error parsing .hugsyrc:', e);
        }

        // Set command folders
        setCommandFolders(commandsData.commands);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    void loadData();
  }, [setConfig]);

  // Update command folders when compiledCommands changes (after Preview)
  useEffect(() => {
    if (compiledCommands) {
      // Convert compiled commands to folder structure
      const folderMap = new Map<string, CommandFile[]>();

      for (const [name, command] of Object.entries(compiledCommands)) {
        const category = command.category ?? 'uncategorized';
        if (!folderMap.has(category)) {
          folderMap.set(category, []);
        }
        folderMap.get(category)!.push({
          name: `${name}.md`,
          path: `.claude/commands/${category}/${name}.md`,
          content: command.content,
        });
      }

      // Convert to array of folders
      const folders: CommandFolder[] = Array.from(folderMap.entries()).map(([name, files]) => ({
        name,
        files: files.sort((a, b) => a.name.localeCompare(b.name)),
      }));

      setCommandFolders(folders.sort((a, b) => a.name.localeCompare(b.name)));

      // Expand all folders to show the new commands
      setExpandedFolders(new Set(folders.map((f) => f.name)));
    }
  }, [compiledCommands]);

  const configString = hugsyrcContent || JSON.stringify(config, null, 2);
  const settingsString = compiledSettings
    ? JSON.stringify(compiledSettings, null, 2)
    : '// Click "Preview" to generate settings.json';

  // Removed mock command data - now using real data from API

  const handleConfigChange = useCallback(
    (value: string | undefined) => {
      if (!value) return;

      setHugsyrcContent(value);

      try {
        const parsed = JSON.parse(value);
        setConfig(parsed);
        setEditorError(null);

        // Save to server
        api.updateHugsyrc(value).catch((err) => {
          console.error('Error saving .hugsyrc:', err);
        });
      } catch (error) {
        setEditorError(error instanceof Error ? error.message : 'Invalid JSON');
      }
    },
    [setConfig]
  );

  const toggleFolder = (folderName: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderName)) {
      newExpanded.delete(folderName);
    } else {
      newExpanded.add(folderName);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCommandSelect = (file: CommandFile) => {
    setSelectedCommand(file);
  };

  const handleCommandEdit = (content: string) => {
    if (selectedCommand) {
      setSelectedCommand({ ...selectedCommand, content });

      // Save to server
      api.updateCommand(selectedCommand.path, content).catch((err) => {
        console.error('Error saving command:', err);
      });
    }
  };

  const handleCommandDelete = async (file: CommandFile) => {
    const commandName = file.name.replace('.md', '');

    try {
      // Always try to delete the file (it might exist locally)
      await api.deleteCommand(file.path);
      addLog({ level: 'info', message: `Deleted command file: ${commandName}` });
    } catch {
      // File might not exist locally (if it's from preview), that's okay
      addLog({
        level: 'info',
        message: `Command '${commandName}' removed from preview (file may not exist locally)`,
      });
    }

    // Clear selected command if it was the deleted one
    if (selectedCommand?.path === file.path) {
      setSelectedCommand(null);
    }

    // If in preview mode, update the display and recalculate what will be created/updated
    if (compiledCommands) {
      // Remove this command from the display
      const updatedFolders = commandFolders
        .map((folder) => ({
          ...folder,
          files: folder.files.filter((f: CommandFile) => f.path !== file.path),
        }))
        .filter((folder) => folder.files.length > 0);
      setCommandFolders(updatedFolders);

      // Recalculate and log what will be created/updated after deletion
      try {
        const currentCommands = await api.getCommands();
        const localCommandNames = new Set<string>();
        for (const folder of currentCommands.commands) {
          for (const f of folder.files) {
            localCommandNames.add(f.name.replace('.md', ''));
          }
        }

        // Get remaining compiled command names from the updated display
        const remainingCompiledNames = new Set<string>();
        for (const folder of updatedFolders) {
          for (const f of folder.files) {
            remainingCompiledNames.add(f.name.replace('.md', ''));
          }
        }

        const toBeAdded = Array.from(remainingCompiledNames).filter(
          (name) => !localCommandNames.has(name)
        );
        const existing = Array.from(remainingCompiledNames).filter((name) =>
          localCommandNames.has(name)
        );

        if (toBeAdded.length > 0) {
          addLog({
            level: 'info',
            message: `Will create ${toBeAdded.length} new command(s): ${toBeAdded.join(', ')}`,
          });
        }

        if (existing.length > 0) {
          addLog({
            level: 'info',
            message: `Will update ${existing.length} existing command(s): ${existing.join(', ')}`,
          });
        }

        if (toBeAdded.length === 0 && existing.length === 0) {
          addLog({
            level: 'warn',
            message: 'No commands will be installed',
          });
        }
      } catch {
        // Ignore error in comparison
      }
    } else {
      // Not in preview mode, reload from disk
      const data = await api.getCommands();
      setCommandFolders(data.commands);
    }
  };

  const isHorizontal = editorLayout === 'horizontal';
  const editorTheme = theme === 'dark' ? 'vs-dark' : 'light';

  const handleExport = () => {
    if (compiledSettings) {
      const blob = new Blob([JSON.stringify(compiledSettings, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'settings.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const themeIcons = {
    light: Sun,
    dark: Moon,
  };

  const Icon = themeIcons[theme];

  // Memoize editor options to prevent recreating on every render
  const editorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on' as const,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: 'on' as const,
      wrappingIndent: 'indent' as const,
      formatOnPaste: true,
      formatOnType: true,
      tabSize: 2,
    }),
    []
  );

  const readOnlyEditorOptions = useMemo(
    () => ({
      ...editorOptions,
      readOnly: true,
    }),
    [editorOptions]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 h-[60px] flex items-center">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Configuration Editor
            </h2>
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
          <div className="flex items-center space-x-2">
            {/* Layout Toggle */}
            <div className="relative group">
              <button
                onClick={toggleEditorLayout}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <PanelLeftOpen
                  className={cn(
                    'w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform',
                    editorLayout === 'horizontal' ? '' : 'rotate-90'
                  )}
                />
              </button>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded shadow-lg border border-gray-200 dark:border-gray-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                Switch to {editorLayout === 'horizontal' ? 'vertical' : 'horizontal'} layout
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -mb-1 w-0 h-0 border-4 border-transparent border-b-white dark:border-b-gray-800"></div>
              </div>
            </div>

            {/* Theme Switcher */}
            <div className="relative group">
              <button
                onClick={() => {
                  const themes: ('light' | 'dark')[] = ['light', 'dark'];
                  const currentIndex = themes.indexOf(theme);
                  const nextIndex = (currentIndex + 1) % themes.length;
                  setTheme(themes[nextIndex]);
                }}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded shadow-lg border border-gray-200 dark:border-gray-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                Switch to {theme === 'light' ? 'dark' : 'light'} mode
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -mb-1 w-0 h-0 border-4 border-transparent border-b-white dark:border-b-gray-800"></div>
              </div>
            </div>

            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

            {/* Export Settings */}
            <div className="relative group">
              <button
                onClick={handleExport}
                disabled={!compiledSettings}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  compiledSettings
                    ? 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                    : 'bg-gray-50 dark:bg-gray-900 opacity-50 cursor-not-allowed'
                )}
              >
                <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded shadow-lg border border-gray-200 dark:border-gray-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                {compiledSettings ? 'Export settings.json' : 'Preview first to export'}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 -mb-1 w-0 h-0 border-4 border-transparent border-b-white dark:border-b-gray-800"></div>
              </div>
            </div>

            {/* Preview Button */}
            <button
              onClick={() => void compile()}
              disabled={isCompiling}
              title="Preview the compiled settings"
              className={cn(
                'flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors',
                isCompiling
                  ? 'bg-gray-300 dark:bg-gray-700 cursor-wait text-white'
                  : 'bg-primary-400 hover:bg-primary-500 dark:bg-primary-700 dark:hover:bg-primary-600 text-white'
              )}
            >
              {isCompiling ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              <span>{isCompiling ? 'Previewing...' : 'Preview'}</span>
            </button>

            {/* Install Button */}
            <button
              onClick={() => void installSettings()}
              disabled={!compiledSettings || isInstalling}
              title={
                !compiledSettings
                  ? 'Preview first to enable install'
                  : 'Install settings.json to your project'
              }
              className={cn(
                'flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all',
                !compiledSettings || isInstalling
                  ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed text-gray-500 dark:text-gray-400'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl'
              )}
            >
              {isInstalling ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <PackageCheck className="w-4 h-4" />
              )}
              <span>{isInstalling ? 'Installing...' : 'Install'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editors */}
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Left section - Source and Output */}
        <Panel defaultSize={isHorizontal ? 66 : 75} minSize={40}>
          <PanelGroup direction={isHorizontal ? 'horizontal' : 'vertical'} className="h-full">
            {/* Source Editor Panel */}
            <Panel defaultSize={50} minSize={30}>
              <motion.div
                className="h-full flex flex-col"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="h-[42px] bg-gray-50 dark:bg-gray-800/50 px-4 border-b border-gray-200 dark:border-gray-800 flex items-center">
                  <div className="flex items-center space-x-2">
                    <FileJson className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      .hugsyrc
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <LazyEditor
                    height="100%"
                    defaultLanguage="json"
                    value={configString}
                    onChange={handleConfigChange}
                    theme={editorTheme}
                    options={editorOptions}
                  />
                </div>
              </motion.div>
            </Panel>

            {/* Resize Handle */}
            <PanelResizeHandle
              className={cn(
                'bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors',
                isHorizontal ? 'w-1' : 'h-1'
              )}
            />

            {/* Output Editor Panel */}
            <Panel defaultSize={50} minSize={30}>
              <motion.div
                className="h-full flex flex-col"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="h-[42px] bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex items-center">
                  <div className="flex items-center justify-between w-full px-4">
                    <div className="flex items-center">
                      <button
                        onClick={() => setOutputTab('settings')}
                        className={cn(
                          'px-3 py-1.5 text-sm font-medium mr-2',
                          outputTab === 'settings'
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        )}
                      >
                        <div className="flex items-center space-x-2">
                          <Code className="w-3.5 h-3.5" />
                          <span>settings.json</span>
                        </div>
                      </button>
                      <button
                        onClick={() => setOutputTab('commands')}
                        className={cn(
                          'px-3 py-1.5 text-sm font-medium',
                          outputTab === 'commands'
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        )}
                      >
                        <div className="flex items-center space-x-2">
                          <Command className="w-3.5 h-3.5" />
                          <span>/commands</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden bg-white dark:bg-gray-900">
                  {outputTab === 'settings' ? (
                    <LazyEditor
                      height="100%"
                      defaultLanguage="json"
                      value={settingsString}
                      theme={editorTheme}
                      options={readOnlyEditorOptions}
                    />
                  ) : (
                    <div className="h-full flex">
                      {/* File Explorer - Compact Style */}
                      <div className="w-48 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col flex-shrink-0">
                        {/* Explorer Header - Match height with file content header */}
                        <div className="h-[42px] px-3 flex items-center border-b border-gray-200 dark:border-gray-800">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center space-x-1.5">
                              <Command className="w-3.5 h-3.5 text-primary-500 dark:text-primary-400" />
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                /commands
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {commandFolders.reduce((acc, f) => acc + f.files.length, 0)} files
                            </span>
                          </div>
                        </div>

                        {/* File Tree */}
                        <div className="flex-1 overflow-y-auto">
                          {commandFolders.map((folder, idx) => (
                            <div key={folder.name}>
                              <button
                                onClick={() => toggleFolder(folder.name)}
                                className="w-full flex items-center px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 group"
                              >
                                <ChevronRight
                                  className={cn(
                                    'w-3 h-3 mr-0.5 text-gray-400 transition-transform flex-shrink-0',
                                    expandedFolders.has(folder.name) && 'rotate-90'
                                  )}
                                />
                                <Folder
                                  className={cn(
                                    'w-3.5 h-3.5 mr-1.5 flex-shrink-0',
                                    expandedFolders.has(folder.name)
                                      ? 'text-primary-500 dark:text-primary-400'
                                      : 'text-gray-400 dark:text-gray-500'
                                  )}
                                />
                                <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate">
                                  {folder.name}/
                                </span>
                                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 pl-1">
                                  {folder.files.length}
                                </span>
                              </button>

                              {expandedFolders.has(folder.name) && (
                                <div>
                                  {folder.files.map((file: CommandFile) => {
                                    const commandName = file.name.replace('.md', '');
                                    return (
                                      <div
                                        key={file.path}
                                        className={cn(
                                          'w-full flex items-center px-2 py-1 group',
                                          selectedCommand?.path === file.path
                                            ? 'bg-primary-100 dark:bg-primary-900/20 border-l-2 border-primary-500'
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                        )}
                                      >
                                        <button
                                          onClick={() => handleCommandSelect(file)}
                                          title={`/${commandName}`}
                                          className="flex items-center flex-1 text-left"
                                        >
                                          <div className="w-3 mr-0.5" /> {/* Indent space */}
                                          <FileText
                                            className={cn(
                                              'w-3.5 h-3.5 mr-1.5 flex-shrink-0',
                                              selectedCommand?.path === file.path
                                                ? 'text-primary-500 dark:text-primary-400'
                                                : 'text-gray-400 dark:text-gray-500'
                                            )}
                                          />
                                          <span
                                            className={cn(
                                              'text-xs',
                                              selectedCommand?.path === file.path
                                                ? 'text-primary-700 dark:text-primary-300 font-medium'
                                                : 'text-gray-600 dark:text-gray-400'
                                            )}
                                          >
                                            /{commandName}
                                          </span>
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void handleCommandDelete(file);
                                          }}
                                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                                          title="Delete command"
                                        >
                                          <X className="w-3 h-3 text-gray-400 hover:text-red-600 dark:hover:text-red-400" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {idx < commandFolders.length - 1 && (
                                <div className="my-1 mx-4 border-b border-gray-100 dark:border-gray-800" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* File Content */}
                      <div className="flex-1 min-w-0 flex flex-col bg-white dark:bg-gray-950">
                        {selectedCommand ? (
                          <>
                            <div className="h-[42px] bg-gray-50 dark:bg-gray-900 px-4 flex items-center border-b border-gray-200 dark:border-gray-800">
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                                    <FileText className="w-4 h-4" />
                                    <span className="text-sm">{selectedCommand.name}</span>
                                  </div>
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    •
                                  </span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                    {selectedCommand.path}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                                    Markdown
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <LazyEditor
                                key={selectedCommand.path}
                                height="100%"
                                defaultLanguage="markdown"
                                value={selectedCommand.content ?? ''}
                                onChange={(value) => handleCommandEdit(value ?? '')}
                                theme={editorTheme}
                                options={editorOptions}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="h-[42px] bg-gray-50 dark:bg-gray-900 px-4 flex items-center border-b border-gray-200 dark:border-gray-800">
                              <div className="flex items-center text-gray-400 dark:text-gray-500">
                                <FileText className="w-4 h-4 mr-2" />
                                <span className="text-sm">No file selected</span>
                              </div>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                              <div className="text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                  <FileText className="w-8 h-8 text-gray-400 dark:text-gray-600" />
                                </div>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                                  Select a command file
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Choose a command from the explorer to view or edit
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </Panel>
          </PanelGroup>
        </Panel>

        {/* Resize Handle between left section and logs */}
        <PanelResizeHandle className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors" />

        {/* Logs Panel */}
        <Panel defaultSize={isHorizontal ? 34 : 25} minSize={20}>
          <LogViewer />
        </Panel>
      </PanelGroup>

      {/* Force Install Dialog */}
      <ConfirmDialog
        isOpen={showForceInstallDialog}
        title="Overwrite Settings?"
        message="Settings file already exists. Do you want to overwrite it?"
        confirmText="Overwrite"
        cancelText="Cancel"
        type="warning"
        onConfirm={() => {
          setShowForceInstallDialog(false);
          void installSettings(true);
        }}
        onCancel={() => setShowForceInstallDialog(false)}
      />
    </div>
  );
}
