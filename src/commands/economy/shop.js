const { SlashCommandBuilder } = require('discord.js');
const { listShopItems } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder().setName('shop').setDescription('Show the server shop.'),
  async execute(interaction) {
    const items = listShopItems(interaction.guild.id);
    if (!items.length) return interaction.reply('🛒 No shop items yet. Use `/addshopitem` to create some.');
    const lines = items.slice(0, 20).map(item => `• **${item.item_name}** — ${item.price} coins${item.stock >= 0 ? ` | stock: ${item.stock}` : ''}\n  key: \`${item.item_key}\`${item.description ? ` — ${item.description}` : ''}`);
    await interaction.reply(`🛒 **${interaction.guild.name} shop**\n${lines.join('\n')}`);
  }
};
