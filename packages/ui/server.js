/* eslint-env node */
/* global console */

import express from 'express';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { Compiler, InstallManager, ConfigManager, PackageManager } from '@hugsylabs/hugsy-core';
import matter from 'gray-matter';

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
      verbose: true, // Enable verbose logging to see what's happening
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

      // Get missing packages
      const missingPackages = compiler.getMissingPackages();

      // Debug logging
      console.log('Original config has subagents:', config.subagents);
      console.log('Compiled subagents:', compiledSubagents.size);
      console.log('Missing packages:', missingPackages);
      console.log('Compiler result settings:', result);

      // Restore console
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;

      res.json({
        success: true,
        settings: result,
        commands: commands,
        subagents: subagents,
        missingPackages: missingPackages,
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

// Get subagents from .claude/agents
app.get('/api/agents', async (req, res) => {
  try {
    const CLAUDE_AGENTS_PATH = path.join(PROJECT_ROOT, '.claude', 'agents');

    // Check if agents directory exists
    const exists = await fs
      .access(CLAUDE_AGENTS_PATH)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      return res.json({ agents: {} });
    }

    const files = await fs.readdir(CLAUDE_AGENTS_PATH);
    const agents = {};

    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(CLAUDE_AGENTS_PATH, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Parse the markdown file with front matter
        const { data, content: body } = matter(content);

        // Extract agent name from filename
        const agentName = file.replace('.md', '');

        // Parse tools string into array if needed
        let tools = data.tools || [];
        if (typeof tools === 'string') {
          tools = tools.split(',').map((t) => t.trim());
        }

        agents[agentName] = {
          name: data.name || agentName,
          description: data.description || '',
          tools: tools,
          content: body.trim(),
        };
      }
    }

    res.json({ agents });
  } catch (error) {
    console.error('Error reading agents:', error);
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

// Install npm packages
app.post('/api/install-packages', async (req, res) => {
  try {
    const { packages } = req.body;
    if (!packages || !Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No packages provided',
      });
    }

    // Use PackageManager from core
    const packageManager = new PackageManager(PROJECT_ROOT);
    const result = await packageManager.installPackages(packages);

    if (result.success) {
      // Add packages to config based on their type
      for (const pkg of packages) {
        const type = packageManager.detectPackageType(pkg);
        try {
          packageManager.addToConfig(pkg, type);
        } catch (error) {
          console.error(`Failed to add ${pkg} to config:`, error);
        }
      }

      res.json(result);
    } else {
      // Return appropriate status code based on error
      const statusCode =
        result.error?.includes('404') || result.error?.includes('Not Found') ? 400 : 500;
      res.status(statusCode).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
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

// Get installed packages
app.get('/api/packages', async (req, res) => {
  try {
    const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
    const packageJson = JSON.parse(fsSync.readFileSync(packageJsonPath, 'utf-8'));

    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    const packages = [];

    // Categorize packages based on naming convention
    const categorizePackage = (name) => {
      if (name.includes('preset')) return 'preset';
      if (name.includes('plugin')) return 'plugin';
      if (name.includes('command')) return 'command';
      if (name.includes('subagent')) return 'subagent';

      // Check by prefix
      if (name.startsWith('@hugsylabs/subagent-')) return 'subagent';
      if (name.startsWith('@hugsylabs/hugsy-') && name.includes('preset')) return 'preset';

      return 'plugin'; // Default category
    };

    // Process all dependencies
    Object.entries({ ...dependencies, ...devDependencies }).forEach(([name, version]) => {
      // Include hugsy-related packages but exclude workspace packages
      console.log(`Checking package: ${name} - ${version}`);
      if (
        (name.includes('hugsy') || name.includes('subagent') || name.startsWith('@hugsylabs/')) &&
        !version.includes('workspace:')
      ) {
        console.log(`Including package: ${name}`);
        packages.push({
          name,
          version: version.replace('^', '').replace('~', ''),
          category: categorizePackage(name),
          description: null, // Could be fetched from npm registry if needed
        });
      }
    });

    res.json({ packages });
  } catch (error) {
    console.error('Error getting packages:', error);
    res.status(500).json({
      error: 'Failed to get packages',
      details: error.message,
    });
  }
});

// Uninstall package
app.post('/api/packages/uninstall', async (req, res) => {
  try {
    const { package: packageName } = req.body;

    if (!packageName) {
      return res.status(400).json({ error: 'Package name is required' });
    }

    console.log(`Uninstalling package: ${packageName}`);

    // Use PackageManager from core
    const packageManager = new PackageManager(PROJECT_ROOT);
    const result = await packageManager.uninstallAndRemoveFromConfig(packageName);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({
        error: result.message,
        details: result.error,
      });
    }
  } catch (error) {
    console.error('Error uninstalling package:', error);
    res.status(500).json({
      error: 'Failed to uninstall package',
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
