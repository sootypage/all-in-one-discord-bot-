const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { upsertShopItem } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addshopitem')
    .setDescription('Add or update a shop item.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option => option.setName('key').setDescription('Item key').setRequired(true))
    .addStringOption(option => option.setName('name').setDescription('Display name').setRequired(true))
    .addIntegerOption(option => option.setName('price').setDescription('Price').setRequired(true).setMinValue(0))
    .addStringOption(option => option.setName('description').setDescription('Description'))
    .addIntegerOption(option => option.setName('stock').setDescription('Stock (-1 for unlimited)')),
  async execute(interaction) {
    const item = upsertShopItem(interaction.guild.id, {
      item_key: interaction.options.getString('key'),
      item_name: interaction.options.getString('name'),
      price: interaction.options.getInteger('price'),
      description: interaction.options.getString('description') || '',
      stock: interaction.options.getInteger('stock') ?? -1
    });
    await interaction.reply(`✅ Shop item saved: **${item.item_name}** for **${item.price}** coins.`);
  }
};
