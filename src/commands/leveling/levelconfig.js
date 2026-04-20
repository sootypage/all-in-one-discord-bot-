const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../../utils/database');
module.exports = {
  data: new SlashCommandBuilder().setName('levelconfig').setDescription('Configure leveling for this server.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(o => o.setName('enabled').setDescription('Enable leveling'))
    .addIntegerOption(o => o.setName('xp_min').setDescription('Minimum XP per message').setMinValue(1).setMaxValue(100))
    .addIntegerOption(o => o.setName('xp_max').setDescription('Maximum XP per message').setMinValue(1).setMaxValue(100))
    .addIntegerOption(o => o.setName('cooldown').setDescription('XP cooldown seconds').setMinValue(5).setMaxValue(600))
    .addChannelOption(o => o.setName('level_channel').setDescription('Level up channel')),
  async execute(interaction) {
    const patch = {}; const enabled = interaction.options.getBoolean('enabled'); const xpMin = interaction.options.getInteger('xp_min'); const xpMax = interaction.options.getInteger('xp_max'); const cooldown = interaction.options.getInteger('cooldown'); const levelChannel = interaction.options.getChannel('level_channel');
    if (enabled !== null) patch.leveling_enabled = enabled ? 1 : 0; if (xpMin) patch.xp_min = xpMin; if (xpMax) patch.xp_max = xpMax; if (cooldown) patch.xp_cooldown_seconds = cooldown; if (levelChannel) patch.level_up_channel_id = levelChannel.id;
    const settings = Object.keys(patch).length ? updateGuildSettings(interaction.guild.id, patch) : getGuildSettings(interaction.guild.id);
    await interaction.reply(`📊 **Leveling Settings**\nEnabled: **${settings.leveling_enabled ? 'Yes' : 'No'}**\nXP Range: **${settings.xp_min}-${settings.xp_max}**\nCooldown: **${settings.xp_cooldown_seconds}s**\nLevel-up channel: **${settings.level_up_channel_id || 'Current channel'}**`);
  }
};
