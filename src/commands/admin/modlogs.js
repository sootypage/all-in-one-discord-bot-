
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const { setAutomodSetting, getAutomodSettings } = require('../../utils/featureStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('Set or clear the moderation log channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set the mod log channel')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to send moderation logs to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('clear')
        .setDescription('Clear the mod log channel')
    )
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View current mod log settings')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel', true);
      await setAutomodSetting(guildId, 'modlog_channel_id', channel.id);

      return interaction.reply({
        content: `Moderation logs will now be sent to ${channel}.`,
        ephemeral: true
      });
    }

    if (sub === 'clear') {
      await setAutomodSetting(guildId, 'modlog_channel_id', null);

      return interaction.reply({
        content: 'Moderation log channel cleared.',
        ephemeral: true
      });
    }

    const cfg = await getAutomodSettings(guildId);

    return interaction.reply({
      content: cfg.modlog_channel_id
        ? `Current mod log channel: <#${cfg.modlog_channel_id}>`
        : 'No mod log channel is set.',
      ephemeral: true
    });
  }
};