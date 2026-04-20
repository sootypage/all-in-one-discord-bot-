const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setAutomodSetting, getAutomodSettings } = require('../../utils/featureStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antibadwords')
    .setDescription('Enable or disable bad word filtering')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(opt =>
      opt.setName('enabled').setDescription('Enable bad word filtering').setRequired(true)
    ),

  async execute(interaction) {
    const enabled = interaction.options.getBoolean('enabled', true);
    await setAutomodSetting(interaction.guild.id, 'antibadwords_enabled', enabled);
    const cfg = await getAutomodSettings(interaction.guild.id);

    await interaction.reply({
      content: `Anti-badwords is now **${cfg.antibadwords_enabled ? 'enabled' : 'disabled'}**.`,
      ephemeral: true
    });
  }
};