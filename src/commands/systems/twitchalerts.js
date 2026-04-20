const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { upsertContentWatcher, removeContentWatcher, listContentWatchers } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitchalerts')
    .setDescription('Manage Twitch live alerts.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Watch a Twitch streamer')
      .addStringOption(option => option.setName('streamer').setDescription('Twitch login name').setRequired(true))
      .addChannelOption(option => option.setName('discord_channel').setDescription('Discord channel for alerts').setRequired(true))
      .addStringOption(option => option.setName('label').setDescription('Nice display name')))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a Twitch watcher')
      .addStringOption(option => option.setName('streamer').setDescription('Twitch login name').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List Twitch watchers')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') {
      const watchers = listContentWatchers(interaction.guild.id, 'twitch');
      if (!watchers.length) return interaction.reply('No Twitch alerts set up yet.');
      return interaction.reply(`🟣 **Twitch alerts**\n${watchers.map(w => `• ${w.source_label || w.source_id} → <#${w.discord_channel_id}>`).join('\n')}`);
    }

    const sourceId = interaction.options.getString('streamer').trim().toLowerCase();
    if (sub === 'remove') {
      removeContentWatcher(interaction.guild.id, 'twitch', sourceId);
      return interaction.reply(`🗑️ Removed Twitch alerts for **${sourceId}**.`);
    }

    const discordChannel = interaction.options.getChannel('discord_channel');
    const label = interaction.options.getString('label') || sourceId;
    upsertContentWatcher({ guildId: interaction.guild.id, type: 'twitch', sourceId, sourceLabel: label, discordChannelId: discordChannel.id });
    return interaction.reply(`✅ Twitch alerts saved for **${label}** in ${discordChannel}.`);
  }
};
