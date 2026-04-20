const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder
} = require('discord.js');
const { getGuildSettings } = require('./database');

const TICKET_OPTIONS = [
  { label: 'Support', value: 'support', description: 'General support help' },
  { label: 'Billing', value: 'billing', description: 'Payments, shop, or purchases' },
  { label: 'Report', value: 'report', description: 'Report a user or issue' },
  { label: 'Other', value: 'other', description: 'Anything else' }
];

function buildTicketPanel() {
  const embed = new EmbedBuilder()
    .setTitle('Open a Ticket')
    .setDescription('Choose a category from the dropdown below and the bot will create a private ticket channel for you.')
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket_category_select')
      .setPlaceholder('Pick a ticket category')
      .addOptions(TICKET_OPTIONS)
  );

  return { embeds: [embed], components: [row] };
}

async function createTicket(interaction, categoryValue) {
  const settings = getGuildSettings(interaction.guild.id);
  const parentId = settings.tickets_category_id || null;
  const supportRoleId = settings.ticket_support_role_id || null;
  const safeName = `${categoryValue}-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80);

  const existing = interaction.guild.channels.cache.find(
    c => c.parentId === parentId && c.topic === `ticket-owner:${interaction.user.id}`
  );
  if (existing) {
    return interaction.reply({ content: `You already have a ticket open: ${existing}`, ephemeral: true });
  }

  const channel = await interaction.guild.channels.create({
    name: safeName || `ticket-${interaction.user.id}`,
    type: ChannelType.GuildText,
    parent: parentId,
    topic: `ticket-owner:${interaction.user.id}`,
    permissionOverwrites: [
      {
        id: interaction.guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      },
      ...(supportRoleId
        ? [{
            id: supportRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          }]
        : [])
    ]
  });

  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
  );

  const embed = new EmbedBuilder()
    .setTitle('Ticket Created')
    .setDescription(`Category: **${categoryValue}**\nA team member will be with you soon.`)
    .setTimestamp();

  await channel.send({
    content: supportRoleId ? `<@&${supportRoleId}> ${interaction.user}` : `${interaction.user}`,
    embeds: [embed],
    components: [controls]
  });

  await interaction.reply({ content: `Your ticket has been created: ${channel}`, ephemeral: true });
}

module.exports = { buildTicketPanel, createTicket, TICKET_OPTIONS };
