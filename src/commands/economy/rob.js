const { SlashCommandBuilder } = require('discord.js');
const { addBalance, getGuildSettings, getUser, setLastRob } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Attempt to rob another user.')
    .addUserOption(option => option.setName('user').setDescription('Target').setRequired(true)),
  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const now = Date.now();
    const cooldown = 60 * 60 * 1000;
    const settings = getGuildSettings(guildId);
    const robber = getUser(guildId, userId);
    const victim = getUser(guildId, target.id);
    if (!settings.economy_enabled) return interaction.reply({ content: 'Economy is disabled in this server.', ephemeral: true });
    if (target.bot || target.id === interaction.user.id) return interaction.reply({ content: 'Pick a real target.', ephemeral: true });
    if (victim.balance < 100) return interaction.reply({ content: 'That user does not have enough coins to rob.', ephemeral: true });
    if (now - robber.last_rob < cooldown) {
      const mins = Math.ceil((cooldown - (now - robber.last_rob)) / 60000);
      return interaction.reply({ content: `You need to wait ${mins} more minute(s) before robbing again.`, ephemeral: true });
    }

    setLastRob(guildId, userId, now);
    const success = Math.random() < 0.4;
    const amount = Math.max(50, Math.floor(victim.balance * (0.05 + Math.random() * 0.15)));

    if (success) {
      addBalance(guildId, target.id, -amount);
      addBalance(guildId, userId, amount);
      return interaction.reply(`🦹 You robbed **${target.username}** and stole **${amount}** coins.`);
    }

    const fine = Math.min(Math.floor(amount / 2), robber.balance);
    addBalance(guildId, userId, -fine);
    return interaction.reply(`💥 You failed to rob **${target.username}** and paid **${fine}** coins in fines.`);
  }
};
