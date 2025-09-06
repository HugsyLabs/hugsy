import { useEffect, useCallback } from 'react';
import useStore from '../store';

interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  cmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description?: string;
}

export const useKeyboardShortcuts = (onShowHelp?: () => void) => {
  const {
    compile,
    installSettings,
    setActiveTab,
    toggleEditorLayout,
    setTheme,
    theme,
    addLog,
    undo,
    redo,
  } = useStore();

  const shortcuts: ShortcutHandler[] = [
    // Save configuration (Cmd/Ctrl + S)
    {
      key: 's',
      ctrl: true,
      cmd: true,
      handler: () => {
        compile()
          .then(() => {
            addLog({
              level: 'success',
              message: 'Configuration saved successfully',
            });
          })
          .catch((error) => {
            addLog({
              level: 'error',
              message: `Failed to save configuration: ${error}`,
            });
          });
      },
      description: 'Save configuration',
    },
    // Undo (Cmd/Ctrl + Z)
    {
      key: 'z',
      ctrl: true,
      cmd: true,
      handler: () => {
        if (undo) {
          undo();
          addLog({
            level: 'info',
            message: 'Undo last change',
          });
        }
      },
      description: 'Undo last change',
    },
    // Redo (Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y)
    {
      key: 'z',
      ctrl: true,
      cmd: true,
      shift: true,
      handler: () => {
        if (redo) {
          redo();
          addLog({
            level: 'info',
            message: 'Redo last change',
          });
        }
      },
      description: 'Redo last change',
    },
    {
      key: 'y',
      ctrl: true,
      cmd: true,
      handler: () => {
        if (redo) {
          redo();
          addLog({
            level: 'info',
            message: 'Redo last change',
          });
        }
      },
      description: 'Redo last change',
    },
    // Quick switch tabs (Cmd/Ctrl + 1-5)
    {
      key: '1',
      ctrl: true,
      cmd: true,
      handler: () => setActiveTab('config'),
      description: 'Switch to Config',
    },
    // Toggle layout (Cmd/Ctrl + L)
    {
      key: 'l',
      ctrl: true,
      cmd: true,
      handler: () => {
        toggleEditorLayout();
        addLog({
          level: 'info',
          message: 'Editor layout toggled',
        });
      },
      description: 'Toggle editor layout',
    },
    // Toggle theme (Cmd/Ctrl + T)
    {
      key: 't',
      ctrl: true,
      cmd: true,
      handler: () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        addLog({
          level: 'info',
          message: `Switched to ${newTheme} theme`,
        });
      },
      description: 'Toggle theme',
    },
    // Install settings (Cmd/Ctrl + I)
    {
      key: 'i',
      ctrl: true,
      cmd: true,
      handler: () => {
        installSettings()
          .then(() => {
            addLog({
              level: 'success',
              message: 'Settings installed successfully',
            });
          })
          .catch((error) => {
            addLog({
              level: 'error',
              message: `Failed to install settings: ${error}`,
            });
          });
      },
      description: 'Install settings',
    },
    // Show keyboard shortcuts help (?)
    {
      key: '?',
      shift: true,
      handler: () => {
        if (onShowHelp) {
          onShowHelp();
        }
      },
      description: 'Show keyboard shortcuts',
    },
  ];

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');

      for (const shortcut of shortcuts) {
        const ctrlKey = isMac ? shortcut.cmd : shortcut.ctrl;

        // Special handling for ? key (Shift + / on most keyboards)
        let keyMatch = false;
        if (shortcut.key === '?' && shortcut.shift) {
          keyMatch = event.key === '?' || (event.key === '/' && event.shiftKey);
        } else {
          keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        }

        if (
          keyMatch &&
          event.ctrlKey === (ctrlKey && !isMac) &&
          event.metaKey === (ctrlKey && isMac) &&
          event.shiftKey === (shortcut.shift ?? false) &&
          event.altKey === (shortcut.alt ?? false)
        ) {
          event.preventDefault();
          shortcut.handler();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return shortcuts;
};

// Export shortcuts for documentation/help modal
export const getShortcutsList = (): ShortcutHandler[] => {
  return [
    {
      key: 's',
      ctrl: true,
      cmd: true,
      description: 'Save configuration',
      handler: () => {
        /* no-op */
      },
    },
    {
      key: 'z',
      ctrl: true,
      cmd: true,
      description: 'Undo last change',
      handler: () => {
        /* no-op */
      },
    },
    {
      key: 'z',
      ctrl: true,
      cmd: true,
      shift: true,
      description: 'Redo last change',
      handler: () => {
        /* no-op */
      },
    },
    {
      key: 'y',
      ctrl: true,
      cmd: true,
      description: 'Redo last change',
      handler: () => {
        /* no-op */
      },
    },
    {
      key: '1',
      ctrl: true,
      cmd: true,
      description: 'Switch to Editor',
      handler: () => {
        /* no-op */
      },
    },
    {
      key: '2',
      ctrl: true,
      cmd: true,
      description: 'Switch to Commands',
      handler: () => {
        /* no-op */
      },
    },
    {
      key: '3',
      ctrl: true,
      cmd: true,
      description: 'Switch to Presets',
      handler: () => {
        /* no-op */
      },
    },
    {
      key: '4',
      ctrl: true,
      cmd: true,
      description: 'Switch to Plugins',
      handler: () => {
        /* no-op */
      },
    },
    {
      key: '5',
      ctrl: true,
      cmd: true,
      description: 'Switch to Logs',
      handler: () => {
        /* no-op */
      },
    },
    {
      key: 'l',
      ctrl: true,
      cmd: true,
      description: 'Toggle editor layout',
      handler: () => {
        /* no-op */
      },
    },
    {
      key: 't',
      ctrl: true,
      cmd: true,
      description: 'Toggle theme',
      handler: () => {
        /* no-op */
      },
    },
    {
      key: 'i',
      ctrl: true,
      cmd: true,
      description: 'Install settings',
      handler: () => {
        /* no-op */
      },
    },
    {
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      handler: () => {
        /* no-op */
      },
    },
  ];
};
