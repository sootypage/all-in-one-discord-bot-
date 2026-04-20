const { SlashCommandBuilder } = require('discord.js');
const { getGuildSettings, getUser, addBalance, setLastDaily } = require('../../utils/database');
module.exports = {
  data: new SlashCommandBuilder().setName('daily').setDescription('Claim your daily coins.'),
  async execute(interaction) {
    const guildId = interaction.guild.id; const userId = interaction.user.id; const now = Date.now();
    const settings = getGuildSettings(guildId); const user = getUser(guildId, userId); const cooldown = 24 * 60 * 60 * 1000;
    if (!settings.economy_enabled) return interaction.reply({ content: 'Economy is disabled in this server.', ephemeral: true });
    if (now - user.last_daily < cooldown) { const remaining = cooldown - (now - user.last_daily); const hours = Math.ceil(remaining / 3600000); return interaction.reply({ content: `You already claimed your daily reward. Try again in about ${hours} hour(s).`, ephemeral: true }); }
    addBalance(guildId, userId, settings.daily_amount); setLastDaily(guildId, userId, now); await interaction.reply(`You claimed **${settings.daily_amount}** coins from your daily reward.`);
  }
};
