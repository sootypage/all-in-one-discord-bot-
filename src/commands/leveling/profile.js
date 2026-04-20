const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Show a user profile with leveling and economy stats.')
    .addUserOption(option => option.setName('user').setDescription('User to view').setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const stats = getUser(interaction.guild.id, user.id);
    const nextLevelXp = stats.level * 100;
    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s profile`)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'Level', value: String(stats.level), inline: true },
        { name: 'XP', value: `${stats.xp}/${nextLevelXp}`, inline: true },
        { name: 'Wallet', value: `${stats.balance}`, inline: true },
        { name: 'Bank', value: `${stats.bank || 0}`, inline: true }
      )
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  }
};
