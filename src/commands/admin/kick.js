const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../utils/modlog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(option => option.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason')),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
    if (!member.kickable) return interaction.reply({ content: 'I cannot kick that user.', ephemeral: true });

    await member.kick(reason);
    await interaction.reply(`👢 Kicked **${user.tag}** for: ${reason}`);
    await sendModLog(interaction.guild, {
      title: 'User Kicked',
      fields: [
        { name: 'User', value: `${user.tag} (${user.id})` },
        { name: 'Moderator', value: `${interaction.user.tag}` },
        { name: 'Reason', value: reason }
      ]
    });
  }
};
