const { SlashCommandBuilder } = require('discord.js');
const { transferToBank } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Move coins from your wallet to your bank.')
    .addIntegerOption(option => option.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)),
  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const result = transferToBank(interaction.guild.id, interaction.user.id, amount);
    if (!result.ok) return interaction.reply({ content: 'You do not have that many coins in your wallet.', ephemeral: true });
    await interaction.reply(`🏦 Deposited **${amount}** coins. Wallet: **${result.user.balance}** | Bank: **${result.user.bank}**`);
  }
};
