const { EmbedBuilder } = require('discord.js');
const { getGuildSettings } = require('./database');

async function sendModLog(guild, payload) {
  const settings = getGuildSettings(guild.id);
  if (!settings.mod_log_channel_id) return;
  const channel = guild.channels.cache.get(settings.mod_log_channel_id);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(payload.title || 'Moderation Log')
    .setDescription(payload.description || 'No details provided.')
    .addFields(...(payload.fields || []))
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => null);
}

module.exports = { sendModLog };
