const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildSettings } = require('../../utils/database');
const { buildTicketPanel } = require('../../utils/tickets');
module.exports = {
  data: new SlashCommandBuilder().setName('setuptickets').setDescription('Setup the ticket system and send the panel.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(o => o.setName('panel_channel').setDescription('Where to send the ticket panel').setRequired(true))
    .addChannelOption(o => o.setName('category').setDescription('Category for ticket channels').setRequired(true))
    .addRoleOption(o => o.setName('support_role').setDescription('Support role').setRequired(false)),
  async execute(interaction) {
    const panelChannel = interaction.options.getChannel('panel_channel'); const category = interaction.options.getChannel('category'); const role = interaction.options.getRole('support_role');
    updateGuildSettings(interaction.guild.id, { tickets_channel_id: panelChannel.id, tickets_category_id: category.id, ticket_support_role_id: role?.id || '' });
    await panelChannel.send(buildTicketPanel());
    await interaction.reply(`🎟️ Ticket panel sent in ${panelChannel}.`);
  }
};
