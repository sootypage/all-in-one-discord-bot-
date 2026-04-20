const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { sendModLog } = require('../../utils/featureStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option => option.setName('user').setDescription('User to timeout').setRequired(true))
    .addIntegerOption(option => option.setName('minutes').setDescription('Minutes').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(option => option.setName('reason').setDescription('Reason')),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
    if (!member.moderatable) return interaction.reply({ content: 'I cannot timeout that user.', ephemeral: true });

    await member.timeout(minutes * 60 * 1000, reason);
    await interaction.reply(`⏳ Timed out **${user.tag}** for **${minutes}** minute(s). Reason: ${reason}`);
    await sendModLog(interaction.guild, {
      title: 'User Timed Out',
      fields: [
        { name: 'User', value: `${user.tag} (${user.id})` },
        { name: 'Moderator', value: `${interaction.user.tag}` },
        { name: 'Length', value: `${minutes} minute(s)` },
        { name: 'Reason', value: reason }
      ]
    });
  }
};
