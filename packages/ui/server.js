import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { exec } from 'child_process';
import util from 'util';
import { Compiler } from '@hugsylabs/hugsy-compiler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execPromise = util.promisify(exec);
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Get .hugsyrc content
app.get('/api/hugsyrc', async (req, res) => {
  try {
    const hugsyrcPath = path.join(__dirname, '../../.hugsyrc.json');
    const content = await fs.readFile(hugsyrcPath, 'utf-8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update .hugsyrc content
app.post('/api/hugsyrc', async (req, res) => {
  try {
    const hugsyrcPath = path.join(__dirname, '../../.hugsyrc.json');
    await fs.writeFile(hugsyrcPath, req.body.content, 'utf-8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compile settings using hugsy compiler
app.post('/api/compile', async (req, res) => {
  try {
    const hugsyrcPath = path.join(__dirname, '../../.hugsyrc.json');
    const projectRoot = path.join(__dirname, '../..');
    
    // Read the config file first
    const configContent = await fs.readFile(hugsyrcPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    // Create compiler instance with projectRoot
    const compiler = new Compiler({
      projectRoot: projectRoot
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
      
      // Restore console
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      
      res.json({ 
        success: true, 
        settings: result,
        commands: commands,
        output: logs.join('\n'),
        error: null 
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
        error: compileError.message
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get commands from .claude/commands
app.get('/api/commands', async (req, res) => {
  try {
    const commandsPath = path.join(__dirname, '../../.claude/commands');
    const folders = await fs.readdir(commandsPath);
    
    const result = [];
    for (const folder of folders) {
      const folderPath = path.join(commandsPath, folder);
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
              content
            });
          }
        }
        
        result.push({
          name: folder,
          files: commandFiles
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
    const fullPath = path.join(__dirname, '../..', commandPath);
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
    const fullPath = path.join(__dirname, '../..', commandPath);
    await fs.unlink(fullPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Install settings using hugsy install command
app.post('/api/install', async (req, res) => {
  try {
    const { force } = req.body || {};
    
    // Run the actual hugsy install command with optional --force flag
    // Use npx to run the local workspace version
    const command = force ? 'npx hugsy install --force' : 'npx hugsy install';
    const { stdout, stderr } = await execPromise(command, {
      cwd: path.join(__dirname, '../..')
    });
    
    // Read the installed settings.json to confirm
    const settingsPath = path.join(__dirname, '../../.claude/settings.json');
    let settings = null;
    try {
      const settingsContent = await fs.readFile(settingsPath, 'utf-8');
      settings = JSON.parse(settingsContent);
    } catch (e) {
      // Settings file might not exist or be invalid
    }
    
    res.json({ 
      success: true, 
      settings,
      output: stdout,
      error: stderr,
      message: 'Settings installed successfully' 
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      output: error.stdout || '',
      stderr: error.stderr || ''
    });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});