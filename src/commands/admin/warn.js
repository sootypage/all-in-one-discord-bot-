const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../utils/modlog');
const { addWarning } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => option.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Warning reason').setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const warnings = addWarning(interaction.guild.id, user.id, interaction.user.id, reason);
    await interaction.reply(`⚠️ Warned **${user.tag}** for: ${reason}\nThey now have **${warnings.length}** warning(s).`);
    await sendModLog(interaction.guild, {
      title: 'User Warned',
      fields: [
        { name: 'User', value: `${user.tag} (${user.id})` },
        { name: 'Moderator', value: `${interaction.user.tag}` },
        { name: 'Reason', value: reason }
      ]
    });
  }
};
