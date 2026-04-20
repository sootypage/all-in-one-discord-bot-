const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { upsertContentWatcher, removeContentWatcher, listContentWatchers } = require('../../utils/database');
const { parseGitHubRepo } = require('../../utils/contentWatchers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('githubalerts')
    .setDescription('Manage GitHub repo alerts.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Watch a GitHub repo')
      .addStringOption(option => option.setName('repo').setDescription('Repo URL or owner/repo').setRequired(true))
      .addChannelOption(option => option.setName('discord_channel').setDescription('Discord channel for alerts').setRequired(true))
      .addStringOption(option => option.setName('label').setDescription('Nice display name')))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a GitHub watcher')
      .addStringOption(option => option.setName('repo').setDescription('Repo URL or owner/repo').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List GitHub watchers')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') {
      const watchers = listContentWatchers(interaction.guild.id, 'github');
      if (!watchers.length) return interaction.reply('No GitHub alerts set up yet.');
      return interaction.reply(`🐙 **GitHub alerts**\n${watchers.map(w => `• ${w.source_label || w.source_id} → <#${w.discord_channel_id}>`).join('\n')}`);
    }

    const sourceId = parseGitHubRepo(interaction.options.getString('repo'));
    if (!sourceId) return interaction.reply({ content: 'I could not read that GitHub repo URL.', ephemeral: true });

    if (sub === 'remove') {
      removeContentWatcher(interaction.guild.id, 'github', sourceId);
      return interaction.reply(`🗑️ Removed GitHub alerts for **${sourceId}**.`);
    }

    const discordChannel = interaction.options.getChannel('discord_channel');
    const label = interaction.options.getString('label') || sourceId;
    upsertContentWatcher({ guildId: interaction.guild.id, type: 'github', sourceId, sourceLabel: label, discordChannelId: discordChannel.id });
    return interaction.reply(`✅ GitHub alerts saved for **${label}** in ${discordChannel}.`);
  }
};
