const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { getGuildSettings } = require('./database');

function formatTemplate(template, memberOrUser, guild) {
  const user = memberOrUser?.user || memberOrUser;
  return String(template || '')
    .replaceAll('{user}', user ? `<@${user.id}>` : 'Unknown user')
    .replaceAll('{username}', user?.username || 'Unknown user')
    .replaceAll('{tag}', user?.tag || user?.username || 'Unknown user')
    .replaceAll('{server}', guild?.name || 'this server')
    .replaceAll('{memberCount}', String(guild?.memberCount || 0));
}

async function sendConfiguredLog(client, guildId, embed) {
  const settings = getGuildSettings(guildId);
  const channelId = settings.log_channel_id || settings.mod_log_channel_id;
  if (!channelId) return false;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return false;
  await channel.send({ embeds: [embed] }).catch(() => null);
  return true;
}

async function handleMemberJoin(member, client) {
  const settings = getGuildSettings(member.guild.id);

  if (settings.auto_role_enabled && settings.auto_role_id) {
    await member.roles.add(settings.auto_role_id, 'Auto role on join').catch(() => null);
  }

  if (settings.welcome_enabled && settings.welcome_channel_id) {
    const channel = await member.guild.channels.fetch(settings.welcome_channel_id).catch(() => null);
    if (channel?.isTextBased()) {
      await channel.send({
        content: formatTemplate(settings.welcome_message, member, member.guild),
        allowedMentions: { users: [member.id] }
      }).catch(() => null);
    }
  }

  if (settings.member_log_enabled) {
    const embed = new EmbedBuilder()
      .setTitle('Member Joined')
      .setDescription(`${member.user.tag} joined the server.`)
      .addFields(
        { name: 'User', value: `${member} (${member.id})`, inline: false },
        { name: 'Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Member Count', value: String(member.guild.memberCount), inline: true }
      )
      .setTimestamp();
    await sendConfiguredLog(client, member.guild.id, embed);
  }
}

async function handleMemberLeave(member, client) {
  const settings = getGuildSettings(member.guild.id);

  if (settings.leave_enabled && settings.leave_channel_id) {
    const channel = await member.guild.channels.fetch(settings.leave_channel_id).catch(() => null);
    if (channel?.isTextBased()) {
      await channel.send({ content: formatTemplate(settings.leave_message, member, member.guild) }).catch(() => null);
    }
  }

  if (settings.member_log_enabled) {
    const embed = new EmbedBuilder()
      .setTitle('Member Left')
      .setDescription(`${member.user?.tag || member.id} left the server.`)
      .addFields(
        { name: 'User ID', value: member.id, inline: true },
        { name: 'Member Count', value: String(member.guild.memberCount), inline: true }
      )
      .setTimestamp();
    await sendConfiguredLog(client, member.guild.id, embed);
  }
}

async function handleVerify(interaction) {
  const settings = getGuildSettings(interaction.guild.id);
  if (!settings.verification_enabled || !settings.verification_role_id) {
    return interaction.reply({ content: 'Verification is not configured on this server yet.', ephemeral: true });
  }

  const role = interaction.guild.roles.cache.get(settings.verification_role_id)
    || await interaction.guild.roles.fetch(settings.verification_role_id).catch(() => null);
  if (!role) return interaction.reply({ content: 'The verification role does not exist anymore.', ephemeral: true });

  await interaction.member.roles.add(role, 'User clicked verification button').catch(error => {
    throw new Error(`I could not add the verification role. Check my role position and Manage Roles permission. ${error.message}`);
  });

  await interaction.reply({ content: `✅ Verified! You now have the ${role} role.`, ephemeral: true });
}

function buildVerificationPanel(message) {
  const embed = new EmbedBuilder()
    .setTitle('Verify to access the server')
    .setDescription(message || 'Click the button below to verify and get access.')
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify_member').setLabel('Verify').setStyle(ButtonStyle.Success)
  );
  return { embeds: [embed], components: [row] };
}

async function logCommand(client, interactionOrMessage, commandName) {
  const guild = interactionOrMessage.guild;
  if (!guild) return;
  const settings = getGuildSettings(guild.id);
  if (!settings.command_log_enabled) return;
  const user = interactionOrMessage.user || interactionOrMessage.author;
  const channel = interactionOrMessage.channel;
  const embed = new EmbedBuilder()
    .setTitle('Command Used')
    .addFields(
      { name: 'Command', value: String(commandName), inline: true },
      { name: 'User', value: user ? `<@${user.id}> (${user.id})` : 'Unknown', inline: false },
      { name: 'Channel', value: channel ? `<#${channel.id}>` : 'Unknown', inline: true }
    )
    .setTimestamp();
  await sendConfiguredLog(client, guild.id, embed);
}

async function logMessageDelete(message, client) {
  if (!message.guild || message.author?.bot) return;
  const settings = getGuildSettings(message.guild.id);
  if (!settings.message_log_enabled) return;
  const embed = new EmbedBuilder()
    .setTitle('Message Deleted')
    .addFields(
      { name: 'Author', value: message.author ? `${message.author} (${message.author.id})` : 'Unknown', inline: false },
      { name: 'Channel', value: `${message.channel}`, inline: true },
      { name: 'Content', value: truncate(message.content || '[no text content]', 1000), inline: false }
    )
    .setTimestamp();
  await sendConfiguredLog(client, message.guild.id, embed);
}

function transcriptLine(message) {
  const time = new Date(message.createdTimestamp).toISOString();
  const author = message.author ? `${message.author.tag} (${message.author.id})` : 'Unknown';
  const content = message.content || '';
  const attachments = message.attachments?.size ? ` Attachments: ${message.attachments.map(a => a.url).join(', ')}` : '';
  return `[${time}] ${author}: ${content}${attachments}`;
}

async function createTicketTranscript(channel) {
  const all = [];
  let before;
  while (all.length < 1000) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || batch.size === 0) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  const sorted = all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const body = sorted.map(transcriptLine).join('\n') || 'No messages found.';
  return new AttachmentBuilder(Buffer.from(body, 'utf8'), { name: `${channel.name}-transcript.txt` });
}

function truncate(text, max) {
  const clean = String(text || '');
  return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean;
}

module.exports = {
  formatTemplate,
  sendConfiguredLog,
  handleMemberJoin,
  handleMemberLeave,
  handleVerify,
  buildVerificationPanel,
  logCommand,
  logMessageDelete,
  createTicketTranscript
};
