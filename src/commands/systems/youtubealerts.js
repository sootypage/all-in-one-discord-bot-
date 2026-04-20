const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { upsertContentWatcher, removeContentWatcher, listContentWatchers } = require('../../utils/database');
const { parseYouTubeChannelId } = require('../../utils/contentWatchers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('youtubealerts')
    .setDescription('Manage YouTube upload alerts.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Watch a YouTube channel')
      .addStringOption(option => option.setName('channel').setDescription('YouTube channel URL or channel ID').setRequired(true))
      .addChannelOption(option => option.setName('discord_channel').setDescription('Discord channel for alerts').setRequired(true))
      .addStringOption(option => option.setName('label').setDescription('Nice display name')))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a YouTube watcher')
      .addStringOption(option => option.setName('channel').setDescription('YouTube channel URL or channel ID').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List YouTube watchers')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') {
      const watchers = listContentWatchers(interaction.guild.id, 'youtube');
      if (!watchers.length) return interaction.reply('No YouTube alerts set up yet.');
      return interaction.reply(`📺 **YouTube alerts**\n${watchers.map(w => `• ${w.source_label || w.source_id} → <#${w.discord_channel_id}>`).join('\n')}`);
    }

    const sourceId = parseYouTubeChannelId(interaction.options.getString('channel'));
    if (!sourceId) return interaction.reply({ content: 'I could not read that YouTube channel URL/ID.', ephemeral: true });

    if (sub === 'remove') {
      removeContentWatcher(interaction.guild.id, 'youtube', sourceId);
      return interaction.reply(`🗑️ Removed YouTube alerts for **${sourceId}**.`);
    }

    const discordChannel = interaction.options.getChannel('discord_channel');
    const label = interaction.options.getString('label') || sourceId;
    upsertContentWatcher({ guildId: interaction.guild.id, type: 'youtube', sourceId, sourceLabel: label, discordChannelId: discordChannel.id });
    return interaction.reply(`✅ YouTube alerts saved for **${label}** in ${discordChannel}.`);
  }
};
