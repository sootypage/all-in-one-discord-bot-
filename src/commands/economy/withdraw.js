const { SlashCommandBuilder } = require('discord.js');
const { transferFromBank } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Move coins from your bank to your wallet.')
    .addIntegerOption(option => option.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)),
  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const result = transferFromBank(interaction.guild.id, interaction.user.id, amount);
    if (!result.ok) return interaction.reply({ content: 'You do not have that many coins in your bank.', ephemeral: true });
    await interaction.reply(`💵 Withdrew **${amount}** coins. Wallet: **${result.user.balance}** | Bank: **${result.user.bank}**`);
  }
};
