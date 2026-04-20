const { SlashCommandBuilder } = require('discord.js');
const { getGuildSettings, getUser, addBalance, setLastWeekly } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder().setName('weekly').setDescription('Claim your weekly reward.'),
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const now = Date.now();
    const cooldown = 7 * 24 * 60 * 60 * 1000;
    const settings = getGuildSettings(guildId);
    const user = getUser(guildId, userId);
    if (!settings.economy_enabled) return interaction.reply({ content: 'Economy is disabled in this server.', ephemeral: true });
    if (now - user.last_weekly < cooldown) {
      const remainingHours = Math.ceil((cooldown - (now - user.last_weekly)) / 3600000);
      return interaction.reply({ content: `You already claimed your weekly reward. Try again in about ${remainingHours} hour(s).`, ephemeral: true });
    }
    const amount = settings.daily_amount * 7;
    addBalance(guildId, userId, amount);
    setLastWeekly(guildId, userId, now);
    await interaction.reply(`📦 You claimed your weekly reward of **${amount}** coins.`);
  }
};
