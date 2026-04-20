const fs = require('fs');
const path = require('path');

function getAllCommandFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllCommandFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function loadCommands(client) {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = getAllCommandFiles(commandsPath);

  for (const file of commandFiles) {
    const command = require(file);
    if (!command.data || !command.execute) {
      console.warn(`Skipping invalid command file: ${file}`);
      continue;
    }
    client.commands.set(command.data.name, command);
  }
}

module.exports = { loadCommands };
