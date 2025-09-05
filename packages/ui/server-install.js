// Alternative implementation without CLI dependency
import { Compiler } from '@hugsylabs/hugsy-core';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export async function installSettings(projectRoot, force = false) {
  const hugsyrcPath = path.join(projectRoot, '.hugsyrc.json');
  const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
  const commandsPath = path.join(projectRoot, '.claude', 'commands');

  // Check if settings.json exists and force flag
  if (!force && existsSync(settingsPath)) {
    throw new Error('Settings file already exists. Use --force to overwrite.');
  }

  // Read config
  const configContent = await fs.readFile(hugsyrcPath, 'utf-8');
  const config = JSON.parse(configContent);

  // Compile
  const compiler = new Compiler({ projectRoot });
  const settings = await compiler.compile(config);
  const commands = compiler.getCompiledCommands();

  // Ensure .claude directory exists
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });

  // Write settings.json
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

  // Write slash commands
  if (commands.size > 0) {
    await fs.mkdir(commandsPath, { recursive: true });

    for (const [name, command] of commands) {
      const commandPath = path.join(commandsPath, `${name}.md`);
      let content = '';

      // Add frontmatter if metadata exists
      if (command.description || command.category) {
        content += '---\n';
        if (command.description) content += `description: ${command.description}\n`;
        if (command.category) content += `category: ${command.category}\n`;
        content += '---\n\n';
      }

      content += command.content;
      await fs.writeFile(commandPath, content);
    }
  }

  return {
    settings,
    commandsCount: commands.size,
    message: `Successfully installed settings to ${settingsPath}`,
  };
}
