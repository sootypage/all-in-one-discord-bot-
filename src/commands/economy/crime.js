const { SlashCommandBuilder } = require('discord.js');
const { addBalance, getGuildSettings, getUser, setLastCrime } = require('../../utils/database');

const successLines = ['You pulled off a risky deal', 'You hacked a fake crypto scammer', 'You sold rare loot', 'You escaped with the bag'];
const failLines = ['You got caught by security', 'Your plan failed badly', 'You dropped the loot while running', 'The target had better guards'];

module.exports = {
  data: new SlashCommandBuilder().setName('crime').setDescription('Take a risky chance for coins.'),
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const now = Date.now();
    const cooldown = 45 * 60 * 1000;
    const settings = getGuildSettings(guildId);
    const user = getUser(guildId, userId);
    if (!settings.economy_enabled) return interaction.reply({ content: 'Economy is disabled in this server.', ephemeral: true });
    if (now - user.last_crime < cooldown) {
      const mins = Math.ceil((cooldown - (now - user.last_crime)) / 60000);
      return interaction.reply({ content: `Lay low for ${mins} more minute(s) before trying crime again.`, ephemeral: true });
    }

    const success = Math.random() < 0.55;
    const amount = Math.floor(Math.random() * 350) + 100;
    setLastCrime(guildId, userId, now);

    if (success) {
      addBalance(guildId, userId, amount);
      return interaction.reply(`🕶️ ${successLines[Math.floor(Math.random() * successLines.length)]} and earned **${amount}** coins.`);
    }

    const penalty = Math.min(amount, user.balance);
    addBalance(guildId, userId, -penalty);
    return interaction.reply(`🚔 ${failLines[Math.floor(Math.random() * failLines.length)]} and lost **${penalty}** coins.`);
  }
};
