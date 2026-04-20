const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../../utils/database');
module.exports = {
  data: new SlashCommandBuilder().setName('economyconfig').setDescription('Configure economy settings for this server.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(o => o.setName('enabled').setDescription('Enable economy'))
    .addIntegerOption(o => o.setName('daily').setDescription('Daily reward').setMinValue(1).setMaxValue(1000000))
    .addIntegerOption(o => o.setName('work_min').setDescription('Minimum work reward').setMinValue(1).setMaxValue(1000000))
    .addIntegerOption(o => o.setName('work_max').setDescription('Maximum work reward').setMinValue(1).setMaxValue(1000000))
    .addIntegerOption(o => o.setName('starter_balance').setDescription('Starting balance for new users').setMinValue(0).setMaxValue(1000000)),
  async execute(interaction) {
    const patch = {}; const enabled = interaction.options.getBoolean('enabled'); const daily = interaction.options.getInteger('daily'); const workMin = interaction.options.getInteger('work_min'); const workMax = interaction.options.getInteger('work_max'); const starterBalance = interaction.options.getInteger('starter_balance');
    if (enabled !== null) patch.economy_enabled = enabled ? 1 : 0; if (daily) patch.daily_amount = daily; if (workMin) patch.work_min = workMin; if (workMax) patch.work_max = workMax; if (starterBalance !== null) patch.starter_balance = starterBalance;
    const settings = Object.keys(patch).length ? updateGuildSettings(interaction.guild.id, patch) : getGuildSettings(interaction.guild.id);
    await interaction.reply(`💼 **Economy Settings**\nEnabled: **${settings.economy_enabled ? 'Yes' : 'No'}**\nDaily: **${settings.daily_amount}**\nWork range: **${settings.work_min}-${settings.work_max}**\nStarter balance: **${settings.starter_balance}**`);
  }
};
