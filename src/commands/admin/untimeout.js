const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../utils/modlog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove a timeout from a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => option.setName('user').setDescription('User to untimeout').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason')),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
    if (!member.moderatable) return interaction.reply({ content: 'I cannot edit that user timeout.', ephemeral: true });

    await member.timeout(null, reason);
    await interaction.reply(`✅ Removed timeout from **${user.tag}**.`);
    await sendModLog(interaction.guild, {
      title: 'User Untimed Out',
      fields: [
        { name: 'User', value: `${user.tag} (${user.id})` },
        { name: 'Moderator', value: `${interaction.user.tag}` },
        { name: 'Reason', value: reason }
      ]
    });
  }
};
