const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode for the current channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(option => option.setName('seconds').setDescription('Slowmode seconds (0-21600)').setRequired(true).setMinValue(0).setMaxValue(21600)),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('seconds');
    await interaction.channel.setRateLimitPerUser(seconds, `Changed by ${interaction.user.tag}`);
    await interaction.reply(`🐢 Slowmode set to **${seconds}** second(s) in ${interaction.channel}.`);
  }
};
