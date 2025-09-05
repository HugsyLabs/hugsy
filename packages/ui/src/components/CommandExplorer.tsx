import { useState, useEffect, memo } from 'react';
import { Folder, FileText, ChevronRight, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { api } from '../services/api';

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

interface CommandExplorerProps {
  selectedCommand: CommandFile | null;
  onSelectCommand: (command: CommandFile | null) => void;
  onDeleteCommand?: (path: string) => void;
}

export const CommandExplorer = memo(function CommandExplorer({
  selectedCommand,
  onSelectCommand,
  onDeleteCommand,
}: CommandExplorerProps) {
  const [commandFolders, setCommandFolders] = useState<CommandFolder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const loadCommands = async () => {
    try {
      const data = await api.getCommands();
      setCommandFolders(
        data.commands.map((folder: CommandFolder) => ({
          ...folder,
          isOpen: expandedFolders.has(folder.name),
        }))
      );
    } catch (error) {
      console.error('Failed to load commands:', error);
    }
  };

  useEffect(() => {
    void loadCommands();
  }, []);

  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderName)) {
        newSet.delete(folderName);
      } else {
        newSet.add(folderName);
      }
      return newSet;
    });
  };

  const handleDeleteCommand = async (path: string) => {
    if (onDeleteCommand) {
      onDeleteCommand(path);
    }
    try {
      await api.deleteCommand(path);
      await loadCommands();
      if (selectedCommand?.path === path) {
        onSelectCommand(null);
      }
    } catch (error) {
      console.error('Failed to delete command:', error);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Slash Commands</h3>

        <div className="space-y-1">
          {commandFolders.map((folder) => (
            <div key={folder.name}>
              <button
                onClick={() => toggleFolder(folder.name)}
                className="w-full flex items-center px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                <ChevronRight
                  className={cn(
                    'w-4 h-4 text-gray-500 transition-transform mr-1',
                    expandedFolders.has(folder.name) && 'rotate-90'
                  )}
                />
                <Folder className="w-4 h-4 text-blue-600 mr-2" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{folder.name}</span>
              </button>

              {expandedFolders.has(folder.name) && (
                <div className="ml-6 mt-1 space-y-1">
                  {folder.files.map((file) => (
                    <div
                      key={file.path}
                      className={cn(
                        'w-full flex items-center px-2 py-1 group',
                        selectedCommand?.path === file.path
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      )}
                    >
                      <button
                        onClick={() => onSelectCommand(file)}
                        className="flex-1 flex items-center text-left"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        <span className="text-sm">{file.name}</span>
                      </button>

                      {onDeleteCommand && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteCommand(file.path);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                        >
                          <X className="w-3 h-3 text-red-600" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
