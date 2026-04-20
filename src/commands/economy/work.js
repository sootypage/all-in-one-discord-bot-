const { SlashCommandBuilder } = require('discord.js');
const { addBalance, getGuildSettings, getUser, setLastWork } = require('../../utils/database');
const jobs = ['worked as a builder', 'cleaned the server room', 'moderated chat', 'delivered pizza', 'fixed some bugs', 'farmed carrots', 'managed tickets'];
module.exports = {
  data: new SlashCommandBuilder().setName('work').setDescription('Work to earn coins.'),
  async execute(interaction) {
    const settings = getGuildSettings(interaction.guild.id); const user = getUser(interaction.guild.id, interaction.user.id); const now = Date.now(); const cooldown = 60 * 60 * 1000;
    if (!settings.economy_enabled) return interaction.reply({ content: 'Economy is disabled in this server.', ephemeral: true });
    if (now - user.last_work < cooldown) { const mins = Math.ceil((cooldown - (now - user.last_work)) / 60000); return interaction.reply({ content: `You are tired. Try working again in ${mins} minute(s).`, ephemeral: true }); }
    const amount = Math.floor(Math.random() * (settings.work_max - settings.work_min + 1)) + settings.work_min;
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    addBalance(interaction.guild.id, interaction.user.id, amount); setLastWork(interaction.guild.id, interaction.user.id, now);
    await interaction.reply(`You ${job} and earned **${amount}** coins.`);
  }
};
