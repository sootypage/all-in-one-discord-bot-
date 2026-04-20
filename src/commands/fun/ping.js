const { SlashCommandBuilder } = require('discord.js');
module.exports = { data: new SlashCommandBuilder().setName('ping').setDescription('Check the bot latency.'), async execute(interaction, client) { await interaction.reply(`Pong! WebSocket ping: ${client.ws.ping}ms`); } };
