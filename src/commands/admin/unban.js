const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');
const { sendModLog } = require('../../utils/featureStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(opt =>
      opt.setName('user_id').setDescription('User ID to unban').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for unban').setRequired(false)
    ),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id', true).trim();
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.guild.members.unban(userId, reason);

      await interaction.reply({
        content: `Unbanned user ID \`${userId}\`.`,
        ephemeral: false
      });

      await sendModLog(interaction.client, interaction.guild.id, {
        title: 'User Unbanned',
        description: `${interaction.user} unbanned user ID \`${userId}\`.`,
        fields: [
          { name: 'Moderator', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
          { name: 'User ID', value: userId, inline: true },
          { name: 'Reason', value: reason, inline: false }
        ]
      });
    } catch (error) {
      console.error('Unban failed:', error);

      await interaction.reply({
        content: 'Failed to unban that user. Make sure the ID is correct and the user is banned.',
        ephemeral: true
      });
    }
  }
};