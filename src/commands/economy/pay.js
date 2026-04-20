const { SlashCommandBuilder } = require('discord.js');
const { transferBalance } = require('../../utils/database');
module.exports = {
  data: new SlashCommandBuilder().setName('pay').setDescription('Pay another member.').addUserOption(o => o.setName('user').setDescription('Who to pay').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)),
  async execute(interaction) {
    const target = interaction.options.getUser('user'); const amount = interaction.options.getInteger('amount');
    if (target.bot || target.id === interaction.user.id) return interaction.reply({ content: 'Pick a different user.', ephemeral: true });
    const result = transferBalance(interaction.guild.id, interaction.user.id, target.id, amount);
    if (!result.ok) return interaction.reply({ content: 'You do not have enough coins.', ephemeral: true });
    await interaction.reply(`💸 You paid **${amount}** coins to **${target.username}**.`);
  }
};
