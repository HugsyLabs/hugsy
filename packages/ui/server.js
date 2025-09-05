/* eslint-env node */
/* global console */

import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { Compiler, InstallManager, ConfigManager } from '@hugsylabs/hugsy-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Safely resolve project root path - prevent directory traversal attacks
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const HUGSYRC_PATH = path.resolve(PROJECT_ROOT, '.hugsyrc.json');
const CLAUDE_SETTINGS_PATH = path.resolve(PROJECT_ROOT, '.claude', 'settings.json');
const CLAUDE_COMMANDS_PATH = path.resolve(PROJECT_ROOT, '.claude', 'commands');

// Validate path is within project root
function validatePath(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error('Path traversal attempt detected');
  }
  return resolved;
}
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Get .hugsyrc content
app.get('/api/hugsyrc', async (req, res) => {
  try {
    const content = await fs.readFile(HUGSYRC_PATH, 'utf-8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update .hugsyrc content
app.post('/api/hugsyrc', async (req, res) => {
  try {
    await fs.writeFile(HUGSYRC_PATH, req.body.content, 'utf-8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compile settings using hugsy compiler
app.post('/api/compile', async (req, res) => {
  try {
    // Read the config file first
    const configContent = await fs.readFile(HUGSYRC_PATH, 'utf-8');
    const config = JSON.parse(configContent);

    // Create compiler instance with projectRoot
    const compiler = new Compiler({
      projectRoot: PROJECT_ROOT,
    });

    // Capture logs
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog.apply(console, args);
    };
    console.error = (...args) => {
      logs.push('[ERROR] ' + args.join(' '));
      originalError.apply(console, args);
    };
    console.warn = (...args) => {
      logs.push('[WARN] ' + args.join(' '));
      originalWarn.apply(console, args);
    };

    try {
      // Compile the configuration - pass config as parameter
      const result = await compiler.compile(config);

      // Get compiled commands
      const compiledCommands = compiler.getCompiledCommands();
      const commands = {};
      for (const [name, command] of compiledCommands) {
        commands[name] = command;
      }

      // Get compiled subagents
      const compiledSubagents = compiler.getCompiledSubagents();
      const subagents = {};
      for (const [name, subagent] of compiledSubagents) {
        subagents[name] = subagent;
      }

      // Restore console
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;

      res.json({
        success: true,
        settings: result,
        commands: commands,
        subagents: subagents,
        output: logs.join('\n'),
        error: null,
      });
    } catch (compileError) {
      // Restore console
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;

      res.json({
        success: false,
        settings: null,
        output: logs.join('\n'),
        error: compileError.message,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get commands from .claude/commands
app.get('/api/commands', async (req, res) => {
  try {
    const folders = await fs.readdir(CLAUDE_COMMANDS_PATH);

    const result = [];
    for (const folder of folders) {
      const folderPath = path.join(CLAUDE_COMMANDS_PATH, folder);
      const stat = await fs.stat(folderPath);

      if (stat.isDirectory()) {
        const files = await fs.readdir(folderPath);
        const commandFiles = [];

        for (const file of files) {
          if (file.endsWith('.md')) {
            const filePath = path.join(folderPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            commandFiles.push({
              name: file,
              path: `.claude/commands/${folder}/${file}`,
              content,
            });
          }
        }

        result.push({
          name: folder,
          files: commandFiles,
        });
      }
    }

    res.json({ commands: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update command file
app.post('/api/commands', async (req, res) => {
  try {
    const { path: commandPath, content } = req.body;
    const fullPath = validatePath(path.resolve(PROJECT_ROOT, commandPath));
    await fs.writeFile(fullPath, content, 'utf-8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete command file
app.delete('/api/commands', async (req, res) => {
  try {
    const { path: commandPath } = req.body;
    const fullPath = validatePath(path.resolve(PROJECT_ROOT, commandPath));
    await fs.unlink(fullPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if configuration exists
app.get('/api/config/exists', async (req, res) => {
  try {
    const configManager = new ConfigManager({ projectRoot: PROJECT_ROOT });
    const exists = configManager.exists();
    res.json({ exists });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available presets
app.get('/api/presets', async (req, res) => {
  try {
    const presets = ConfigManager.getAvailablePresets();
    res.json({ presets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize configuration
app.post('/api/init', async (req, res) => {
  try {
    const { preset = 'recommended', force = false } = req.body;
    const configManager = new ConfigManager({ projectRoot: PROJECT_ROOT });

    // Check if already exists
    if (configManager.exists() && !force) {
      return res.status(400).json({
        success: false,
        error: 'Configuration already exists. Use force: true to overwrite.',
      });
    }

    // Initialize with preset
    const success = configManager.init({ force, preset });

    if (success) {
      // Read back the created config
      const config = configManager.read();
      res.json({
        success: true,
        config,
        message: `Configuration initialized with ${preset} preset`,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to initialize configuration',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get existing .claude/settings.json
app.get('/api/settings', async (req, res) => {
  try {
    // Check if settings.json exists
    const exists = await fs
      .access(CLAUDE_SETTINGS_PATH)
      .then(() => true)
      .catch(() => false);

    if (exists) {
      const settingsContent = await fs.readFile(CLAUDE_SETTINGS_PATH, 'utf-8');
      const settings = JSON.parse(settingsContent);
      res.json({ settings, exists: true });
    } else {
      res.json({ settings: null, exists: false });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Install settings using InstallManager
app.post('/api/install', async (req, res) => {
  try {
    const { force } = req.body || {};

    // Read and compile configuration
    const configManager = new ConfigManager({ projectRoot: PROJECT_ROOT });
    const config = configManager.read();

    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'No .hugsyrc.json found. Please create configuration first.',
      });
    }

    // Compile the configuration
    const compiler = new Compiler({ projectRoot: PROJECT_ROOT });
    const compiledSettings = await compiler.compile(config);
    const commands = compiler.getCompiledCommands();
    const subagents = compiler.getCompiledSubagents();

    // Use InstallManager to install
    const installer = new InstallManager({
      projectRoot: PROJECT_ROOT,
      force: force || false,
    });

    const result = installer.install(compiledSettings, commands, subagents);

    if (result.success) {
      // Read the installed settings.json to confirm
      let settings = null;
      try {
        const settingsContent = await fs.readFile(CLAUDE_SETTINGS_PATH, 'utf-8');
        settings = JSON.parse(settingsContent);
      } catch {
        // Settings file might not exist or be invalid
      }

      res.json({
        success: true,
        settings,
        output: result.message,
        backupPath: result.backupPath,
        commandsCount: result.commandsCount,
      });
    } else {
      res.json({
        success: false,
        error: result.message,
        errors: result.errors,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
