const { SlashCommandBuilder } = require('discord.js');
const { getInventory } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your inventory or someone else\'s.')
    .addUserOption(option => option.setName('user').setDescription('User')),
  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const items = getInventory(interaction.guild.id, target.id);
    if (!items.length) return interaction.reply(`🎒 **${target.username}** has no items yet.`);
    const lines = items.map(item => `• **${item.item_name || item.item_key}** x${item.quantity}`);
    await interaction.reply(`🎒 **${target.username}'s inventory**\n${lines.join('\n')}`);
  }
};
