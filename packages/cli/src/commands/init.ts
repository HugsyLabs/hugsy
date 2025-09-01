/**
 * Init command - Initialize Hugsy configuration in current project
 */

import { Command } from 'commander';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import prompts from 'prompts';
import { logger } from '../utils/logger.js';
import { ProjectConfig } from '../utils/project-config.js';
import { Compiler } from '@hugsylabs/hugsy-compiler';
import type { HugsyConfig } from '@hugsylabs/hugsy-compiler';

// Available presets
const presets = {
  recommended: {
    name: 'Recommended',
    description: 'Best practices for secure and reliable code generation',
  },
  security: {
    name: 'Security-focused',
    description: 'Strict security controls to prevent sensitive data exposure',
  },
  permissive: {
    name: 'Permissive',
    description: 'Allow most actions, only block dangerous operations',
  },
  custom: {
    name: 'Custom',
    description: 'Create your own configuration',
  },
};

export function initCommand(): Command {
  const command = new Command('init');

  command
    .description('Initialize Hugsy configuration in current project')
    .argument('[preset]', 'Preset to use (recommended, security, permissive)', 'custom')
    .option('-f, --force', 'Overwrite existing configuration')
    .option('--no-install', 'Skip automatic installation after initialization')
    .action(async (preset, options) => {
      logger.section('Initializing Hugsy Configuration');

      try {
        // Check for existing config
        if (ProjectConfig.exists() && !options.force) {
          logger.error('Configuration already exists (.hugsyrc.json)');
          logger.info('Use --force to overwrite');
          return;
        }

        // Validate preset
        if (preset && !presets[preset as keyof typeof presets]) {
          logger.error(`Unknown preset: ${preset}`);
          logger.info(`Available presets: ${Object.keys(presets).join(', ')}`);
          return;
        }

        let config: HugsyConfig;

        // Interactive mode if custom or no preset
        if (preset === 'custom' || !preset) {
          const response = await prompts([
            {
              type: 'select',
              name: 'preset',
              message: 'Choose a configuration preset',
              choices: Object.entries(presets).map(([key, value]) => ({
                title: `${value.name} - ${value.description}`,
                value: key,
              })),
            },
          ]);

          if (!response.preset) {
            logger.warning('Initialization cancelled');
            return;
          }

          preset = response.preset;
        }

        // Create configuration based on preset
        if (preset === 'custom') {
          config = await createCustomConfig();
        } else {
          config = getPresetConfig(preset);
        }

        // Write configuration
        const configPath = join(process.cwd(), '.hugsyrc.json');
        writeFileSync(configPath, JSON.stringify(config, null, 2));

        logger.success('Created .hugsyrc.json');

        // Show summary
        logger.divider();
        logger.section('Configuration Summary');
        logger.item('Preset', presets[preset as keyof typeof presets].name);

        if (config.extends) {
          const extendsList = Array.isArray(config.extends) ? config.extends : [config.extends];
          logger.item('Extends', extendsList.join(', '));
        }

        if (config.plugins && config.plugins.length > 0) {
          logger.item('Plugins', config.plugins.join(', '));
        }

        // Automatically install unless --no-install is specified
        if (options.install !== false) {
          logger.divider();
          logger.section('Installing Configuration');
          
          try {
            // Compile the configuration
            const compiler = new Compiler({
              projectRoot: process.cwd(),
              verbose: false,
            });
            const compiledSettings = await compiler.compile(config);
            
            // Create .claude directory
            const claudeDir = join(process.cwd(), '.claude');
            if (!existsSync(claudeDir)) {
              mkdirSync(claudeDir, { recursive: true });
              logger.success('Created .claude directory');
            }
            
            // Write compiled settings
            const settingsPath = join(claudeDir, 'settings.json');
            writeFileSync(settingsPath, JSON.stringify(compiledSettings, null, 2));
            logger.success('Created .claude/settings.json');
            
            // Success message
            logger.divider();
            logger.success('Hugsy initialized and installed successfully!');
            logger.section('Next Steps');
            logger.item('Your Claude Code configuration is now active');
            logger.item(`Edit ${chalk.cyan('.hugsyrc.json')} to customize your configuration`);
            logger.item(`Run ${chalk.cyan('hugsy status')} to verify installation`);
          } catch (installError) {
            logger.warning('Failed to automatically install configuration');
            logger.info(`Run ${chalk.cyan('hugsy install')} manually to complete setup`);
            if (process.env.HUGSY_DEBUG) {
              console.error(installError);
            }
          }
        } else {
          logger.section('Next Steps');
          logger.item(
            `Run ${chalk.cyan('hugsy install')} to compile and activate your configuration`
          );
          logger.item(`Edit ${chalk.cyan('.hugsyrc.json')} to customize your configuration`);
          logger.item(
            `Check ${chalk.cyan('.claude/settings.json')} after install to see compiled output`
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Initialization failed: ${errorMessage}`);
        if (process.env.HUGSY_DEBUG) {
          console.error(error);
        }
      }
    });

  return command;
}

/**
 * Create custom configuration through prompts
 */
async function createCustomConfig(): Promise<HugsyConfig> {
  let featuresSelected: string[] | undefined;

  const responses = await prompts([
    {
      type: 'confirm',
      name: 'useRecommended',
      message: 'Start with recommended settings as a base?',
      initial: true,
    },
    {
      type: 'multiselect',
      name: 'features',
      message: 'Which features do you want to configure?',
      choices: [
        { title: 'Permissions - Control tool access', value: 'permissions', selected: true },
        { title: 'Hooks - Run commands on events', value: 'hooks' },
        { title: 'Environment - Set environment variables', value: 'env' },
        { title: 'Status Line - Custom status display', value: 'statusLine' },
      ],
    },
    {
      type: (prev, values) => {
        featuresSelected = values.features;
        return prev?.includes('permissions') ? ('multiselect' as const) : null;
      },
      name: 'denyPatterns',
      message: 'Select operations to DENY (block completely)',
      choices: [
        { title: 'Writing passwords/secrets to files', value: 'Write(*:*password=*)' },
        { title: 'Reading .env files', value: 'Read(**/.env)' },
        { title: 'Dangerous bash commands (rm -rf)', value: 'Bash(rm -rf /*)' },
        { title: 'Installing npm packages globally', value: 'Bash(npm install -g *)' },
        { title: 'Modifying git configuration', value: 'Bash(git config *)' },
      ],
    },
    {
      type: () => (featuresSelected?.includes('permissions') ? ('multiselect' as const) : null),
      name: 'askPatterns',
      message: 'Select operations to ASK permission for',
      choices: [
        { title: 'Sudo commands', value: 'Bash(sudo *)' },
        { title: 'Publishing packages', value: 'Bash(npm publish)' },
        { title: 'Modifying production files', value: 'Write(**/production/**)' },
        { title: 'Database operations', value: 'Bash(*sql*)' },
      ],
    },
  ]);

  const config: HugsyConfig = {};

  // Start with recommended base if requested
  if (responses.useRecommended) {
    config.extends = '@hugsy/recommended';
  }

  // Add permissions
  if (responses.features?.includes('permissions')) {
    config.permissions = {};

    if (responses.denyPatterns && responses.denyPatterns.length > 0) {
      config.permissions.deny = responses.denyPatterns;
    }

    if (responses.askPatterns && responses.askPatterns.length > 0) {
      config.permissions.ask = responses.askPatterns;
    }
  }

  // Add environment variables
  if (responses.features?.includes('env')) {
    config.env = {
      NODE_ENV: 'development',
      HUGSY_ENABLED: 'true',
    };
  }

  // Add status line
  if (responses.features?.includes('statusLine')) {
    config.statusLine = {
      type: 'static',
      text: '🛡️ Protected by Hugsy',
    };
  }

  return config;
}

/**
 * Get preset configuration
 */
function getPresetConfig(name: string): HugsyConfig {
  const configs: Record<string, HugsyConfig> = {
    recommended: {
      extends: '@hugsy/recommended',
      env: {
        NODE_ENV: 'development',
      },
    },
    security: {
      extends: '@hugsy/strict',
      permissions: {
        deny: [
          'Write(*:*password=*)',
          'Write(*:*secret=*)',
          'Write(*:*api_key=*)',
          'Write(*:*token=*)',
          'Read(**/.env*)',
          'Read(**/secrets/**)',
          'Bash(curl *)',
          'Bash(wget *)',
          'WebSearch(*)',
        ],
        ask: ['Bash(sudo *)', 'Bash(npm *)', 'Bash(pip *)', 'Write(**)'],
      },
      env: {
        NODE_ENV: 'production',
        STRICT_MODE: 'true',
      },
    },
    permissive: {
      extends: '@hugsy/development',
      permissions: {
        deny: [
          'Bash(rm -rf /*)',
          'Bash(:(){ :|:& };:)', // Fork bomb
        ],
        allow: ['Read(**)', 'Write(**)', 'Bash(*)'],
      },
    },
  };

  return configs[name] || configs.recommended;
}
