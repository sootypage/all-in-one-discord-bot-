const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setAutomodSetting, getAutomodSettings } = require('../../utils/featureStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antiinvite')
    .setDescription('Enable or disable anti-invite')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(opt =>
      opt.setName('enabled').setDescription('Enable anti-invite').setRequired(true)
    ),

  async execute(interaction) {
    const enabled = interaction.options.getBoolean('enabled', true);

    await setAutomodSetting(interaction.guild.id, 'antiinvite_enabled', enabled);
    const cfg = await getAutomodSettings(interaction.guild.id);

    await interaction.reply({
      content: `Anti-invite is now **${cfg.antiinvite_enabled ? 'enabled' : 'disabled'}**.`,
      ephemeral: true
    });
  }
};