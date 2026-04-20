const { SlashCommandBuilder } = require('discord.js');
module.exports = { data: new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin.'), async execute(interaction) { await interaction.reply(`🪙 ${Math.random() < 0.5 ? 'Heads' : 'Tails'}`); } };
