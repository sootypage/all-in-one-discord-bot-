const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { updateGuildSettings, getGuildSettings } = require('../../utils/database');
const { buildVerificationPanel } = require('../../utils/guildSystems');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verificationpanel')
    .setDescription('Configure verification and send a verify button panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(option => option
      .setName('channel')
      .setDescription('Channel to send the verification panel in')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true))
    .addRoleOption(option => option
      .setName('role')
      .setDescription('Role users get after clicking verify')
      .setRequired(true))
    .addStringOption(option => option
      .setName('message')
      .setDescription('Panel message')
      .setRequired(false)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel', true);
    const role = interaction.options.getRole('role', true);
    const message = interaction.options.getString('message') || getGuildSettings(interaction.guild.id).verification_message;

    updateGuildSettings(interaction.guild.id, {
      verification_enabled: 1,
      verification_channel_id: channel.id,
      verification_role_id: role.id,
      verification_message: message
    });

    await channel.send(buildVerificationPanel(message));
    await interaction.reply({ content: `✅ Verification panel sent in ${channel}. Users will get ${role}.`, ephemeral: true });
  }
};
