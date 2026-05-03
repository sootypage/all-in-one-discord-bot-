const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const { token, clientId, guildId } = require('../config');

function getAllCommandFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...getAllCommandFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
  }

  return files;
}

async function registerCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'commands');
  const files = getAllCommandFiles(commandsPath);

  for (const file of files) {
    const command = require(file);
    if (command.data) commands.push(command.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(token);
  if (process.env.REGISTER_GLOBAL_COMMANDS === 'false' && guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`Registered ${commands.length} guild slash commands for ${guildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log(`Registered ${commands.length} global slash commands for all servers. Global commands can take up to 1 hour to appear.`);
  }
}

module.exports = { registerCommands };
