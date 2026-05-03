const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { updateGuildSettings } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcomesetup')
    .setDescription('Configure welcome and leave messages.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('welcome_channel').setDescription('Welcome channel').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .addStringOption(o => o.setName('welcome_message').setDescription('Use {user}, {username}, {server}, {memberCount}').setRequired(false))
    .addChannelOption(o => o.setName('leave_channel').setDescription('Leave channel').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .addStringOption(o => o.setName('leave_message').setDescription('Use {user}, {username}, {server}, {memberCount}').setRequired(false)),
  async execute(interaction) {
    const welcomeChannel = interaction.options.getChannel('welcome_channel');
    const leaveChannel = interaction.options.getChannel('leave_channel');
    const welcomeMessage = interaction.options.getString('welcome_message');
    const leaveMessage = interaction.options.getString('leave_message');
    const patch = {};
    if (welcomeChannel) { patch.welcome_enabled = 1; patch.welcome_channel_id = welcomeChannel.id; }
    if (welcomeMessage) { patch.welcome_enabled = 1; patch.welcome_message = welcomeMessage; }
    if (leaveChannel) { patch.leave_enabled = 1; patch.leave_channel_id = leaveChannel.id; }
    if (leaveMessage) { patch.leave_enabled = 1; patch.leave_message = leaveMessage; }
    updateGuildSettings(interaction.guild.id, patch);
    await interaction.reply({ content: '✅ Welcome/leave settings saved.', ephemeral: true });
  }
};
