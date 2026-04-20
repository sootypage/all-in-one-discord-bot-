const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { setAutomodSetting, getAutomodSettings } = require('../../utils/featureStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antispam')
    .setDescription('Configure anti-spam')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(opt =>
      opt.setName('enabled').setDescription('Enable anti-spam').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('limit').setDescription('Messages allowed in the window').setMinValue(3).setMaxValue(20)
    )
    .addIntegerOption(opt =>
      opt.setName('window_seconds').setDescription('Time window in seconds').setMinValue(3).setMaxValue(60)
    )
    .addIntegerOption(opt =>
      opt.setName('timeout_minutes').setDescription('Timeout minutes after spam').setMinValue(0).setMaxValue(10080)
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const enabled = interaction.options.getBoolean('enabled', true);
    const limit = interaction.options.getInteger('limit');
    const windowSeconds = interaction.options.getInteger('window_seconds');
    const timeoutMinutes = interaction.options.getInteger('timeout_minutes');

    await setAutomodSetting(guildId, 'antispam_enabled', enabled);

    if (limit !== null) {
      await setAutomodSetting(guildId, 'antispam_limit', limit);
    }

    if (windowSeconds !== null) {
      await setAutomodSetting(guildId, 'antispam_window_ms', windowSeconds * 1000);
    }

    if (timeoutMinutes !== null) {
      await setAutomodSetting(guildId, 'antispam_timeout_minutes', timeoutMinutes);
    }

    const cfg = await getAutomodSettings(guildId);

    await interaction.reply({
      content:
        `Anti-spam is now **${cfg.antispam_enabled ? 'enabled' : 'disabled'}**.\n` +
        `Limit: **${cfg.antispam_limit}** messages\n` +
        `Window: **${Math.floor(cfg.antispam_window_ms / 1000)}s**\n` +
        `Timeout: **${cfg.antispam_timeout_minutes}** minute(s)`,
      ephemeral: true
    });
  }
};