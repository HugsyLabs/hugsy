/**
 * Logger utilities for CLI output
 */

import chalk from 'chalk';
import ora from 'ora';

export const logger = {
  success(message: string) {
    console.log(chalk.green('✅'), message);
  },

  error(message: string) {
    console.error(chalk.red('❌'), message);
  },

  warning(message: string) {
    console.log(chalk.yellow('⚠️'), message);
  },

  info(message: string) {
    console.log(chalk.blue('ℹ'), message);
  },

  debug(message: string) {
    if (process.env.HUGSY_DEBUG) {
      console.log(chalk.gray('[DEBUG]'), message);
    }
  },

  section(title: string) {
    console.log('\n' + chalk.bold.underline(title));
  },

  item(label: string, value?: string) {
    if (value !== undefined) {
      console.log(`  ${chalk.gray('•')} ${label}: ${chalk.cyan(value)}`);
    } else {
      console.log(`  ${chalk.gray('•')} ${label}`);
    }
  },

  spinner(text: string) {
    return ora({
      text,
      spinner: 'dots',
    });
  },

  divider() {
    console.log(chalk.gray('─'.repeat(50)));
  },

  box(content: string) {
    const lines = content.split('\n');
    const maxLength = Math.max(...lines.map((l) => l.length));
    const border = '─'.repeat(maxLength + 2);

    console.log(chalk.gray(`┌${border}┐`));
    lines.forEach((line) => {
      const padding = ' '.repeat(maxLength - line.length);
      console.log(chalk.gray('│ ') + line + padding + chalk.gray(' │'));
    });
    console.log(chalk.gray(`└${border}┘`));
  },
};
