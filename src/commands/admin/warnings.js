const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { listWarnings, clearWarnings } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View or clear warnings for a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('View warnings')
      .addUserOption(option => option.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('clear')
      .setDescription('Clear warnings')
      .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    if (sub === 'clear') {
      clearWarnings(interaction.guild.id, user.id);
      return interaction.reply(`🧽 Cleared warnings for **${user.tag}**.`);
    }
    const warnings = listWarnings(interaction.guild.id, user.id);
    if (!warnings.length) return interaction.reply(`No warnings found for **${user.tag}**.`);
    const lines = warnings.slice(0, 10).map((entry, index) => `**${index + 1}.** ${entry.reason} — <@${entry.moderator_id}>`);
    return interaction.reply(`⚠️ **Warnings for ${user.tag}**\n${lines.join('\n')}`);
  }
};
