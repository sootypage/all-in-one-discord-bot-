const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../utils/modlog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option => option.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason')),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
    if (!member.bannable) return interaction.reply({ content: 'I cannot ban that user.', ephemeral: true });

    await member.ban({ reason });
    await interaction.reply(`🔨 Banned **${user.tag}** for: ${reason}`);
    await sendModLog(interaction.guild, {
      title: 'User Banned',
      fields: [
        { name: 'User', value: `${user.tag} (${user.id})` },
        { name: 'Moderator', value: `${interaction.user.tag}` },
        { name: 'Reason', value: reason }
      ]
    });
  }
};
