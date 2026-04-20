const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../../utils/database');
module.exports = {
  data: new SlashCommandBuilder().setName('setconfig').setDescription('Set per-server channels and role settings.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('modlog').setDescription('Moderation log channel'))
    .addChannelOption(o => o.setName('ticket_panel').setDescription('Ticket panel channel'))
    .addChannelOption(o => o.setName('ticket_category').setDescription('Ticket category'))
    .addRoleOption(o => o.setName('ticket_role').setDescription('Support role')),
  async execute(interaction) {
    const patch = {}; const modlog = interaction.options.getChannel('modlog'); const ticketPanel = interaction.options.getChannel('ticket_panel'); const ticketCategory = interaction.options.getChannel('ticket_category'); const ticketRole = interaction.options.getRole('ticket_role');
    if (modlog) patch.mod_log_channel_id = modlog.id; if (ticketPanel) patch.tickets_channel_id = ticketPanel.id; if (ticketCategory) patch.tickets_category_id = ticketCategory.id; if (ticketRole) patch.ticket_support_role_id = ticketRole.id;
    const settings = Object.keys(patch).length ? updateGuildSettings(interaction.guild.id, patch) : getGuildSettings(interaction.guild.id);
    await interaction.reply(`⚙️ Saved config for **${interaction.guild.name}**\nMod log: **${settings.mod_log_channel_id || 'Not set'}**\nTicket panel: **${settings.tickets_channel_id || 'Not set'}**\nTicket category: **${settings.tickets_category_id || 'Not set'}**\nTicket support role: **${settings.ticket_support_role_id || 'Not set'}**`);
  }
};
