const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete messages in bulk.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option => option.setName('amount').setDescription('Amount to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.reply({ content: `🧹 Deleted ${deleted.size} message(s).`, ephemeral: true });
  }
};
