/**
 * UI command - Launch the Hugsy web UI
 */

import { Command } from 'commander';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../utils/logger.js';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function uiCommand(): Command {
  const command = new Command('ui');

  command
    .description('Launch the Hugsy web UI')
    .option('-p, --port <port>', 'Port to run the UI on', '3456')
    .option('-n, --no-open', "Don't open browser automatically")
    .action((options) => {
      logger.section('Launching Hugsy UI');

      try {
        // Path to UI package
        const uiPath = resolve(__dirname, '../../../ui');

        logger.info(`Starting UI server on port ${options.port}...`);

        // Start the UI server
        const uiProcess = spawn('npm', ['run', 'dev', '--', '--port', options.port], {
          cwd: uiPath,
          stdio: 'inherit',
          shell: true,
        });

        // Handle process events
        uiProcess.on('error', (error) => {
          logger.error(`Failed to start UI server: ${error.message}`);
          process.exit(1);
        });

        // Give the server a moment to start, then open browser
        if (options.open) {
          setTimeout(() => {
            const url = `http://localhost:${options.port}`;
            logger.success(`UI server running at ${url}`);
            logger.info('Opening browser...');
            void open(url);
          }, 2000);
        }

        // Handle graceful shutdown
        process.on('SIGINT', () => {
          logger.info('\nShutting down UI server...');
          uiProcess.kill();
          process.exit(0);
        });

        process.on('SIGTERM', () => {
          uiProcess.kill();
          process.exit(0);
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to launch UI: ${errorMessage}`);
        if (process.env.HUGSY_DEBUG) {
          console.error(error);
        }
        process.exit(1);
      }
    });

  return command;
}
