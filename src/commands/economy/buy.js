const { SlashCommandBuilder } = require('discord.js');
const { buyShopItem } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy an item from the shop.')
    .addStringOption(option => option.setName('item').setDescription('Item key').setRequired(true))
    .addIntegerOption(option => option.setName('quantity').setDescription('Quantity').setMinValue(1)),
  async execute(interaction) {
    const itemKey = interaction.options.getString('item');
    const quantity = interaction.options.getInteger('quantity') || 1;
    const result = buyShopItem(interaction.guild.id, interaction.user.id, itemKey, quantity);
    if (!result.ok) {
      const messages = {
        item_not_found: 'That item does not exist.',
        out_of_stock: 'That item is out of stock.',
        insufficient_funds: `You need **${result.totalCost}** coins for that purchase.`
      };
      return interaction.reply({ content: messages[result.reason] || 'Purchase failed.', ephemeral: true });
    }
    await interaction.reply(`🛒 Bought **${quantity}x ${result.item.item_name}** for **${result.totalCost}** coins.`);
  }
};
