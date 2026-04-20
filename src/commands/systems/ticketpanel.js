const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildTicketPanel } = require('../../utils/tickets');
module.exports = {
  data: new SlashCommandBuilder().setName('ticketpanel').setDescription('Send the ticket dropdown panel in this channel.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) { await interaction.channel.send(buildTicketPanel()); await interaction.reply({ content: 'Ticket panel posted.', ephemeral: true }); }
};
