const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../../utils/database');
module.exports = {
  data: new SlashCommandBuilder().setName('tempvcconfig').setDescription('Configure temporary voice channels.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(o => o.setName('create_channel').setDescription('Voice channel users join to create a temp VC'))
    .addChannelOption(o => o.setName('category').setDescription('Category for created temp VCs')),
  async execute(interaction) {
    const patch = {}; const createChannel = interaction.options.getChannel('create_channel'); const category = interaction.options.getChannel('category');
    if (createChannel) patch.temp_vc_create_channel_id = createChannel.id; if (category) patch.temp_vc_category_id = category.id;
    const settings = Object.keys(patch).length ? updateGuildSettings(interaction.guild.id, patch) : getGuildSettings(interaction.guild.id);
    await interaction.reply(`🎧 Temp VC settings saved.\nCreate channel: **${settings.temp_vc_create_channel_id || 'Not set'}**\nCategory: **${settings.temp_vc_category_id || 'Not set'}**`);
  }
};
