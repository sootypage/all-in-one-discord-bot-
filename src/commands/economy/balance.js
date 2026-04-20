const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check a balance.')
    .addUserOption(option => option.setName('user').setDescription('User to check')),
  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const user = getUser(interaction.guild.id, target.id);
    await interaction.reply(`💰 **${target.username}**\nWallet: **${user.balance}** coins\nBank: **${user.bank || 0}** coins\nLevel: **${user.level}**`);
  }
};
