const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nickname')
    .setDescription('Change a member nickname.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
    .addStringOption(option => option.setName('name').setDescription('New nickname').setRequired(true)),

  async execute(interaction) {
    const user = interaction.options.getUser('user');
    const name = interaction.options.getString('name');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
    if (!member.manageable) return interaction.reply({ content: 'I cannot rename that user.', ephemeral: true });

    await member.setNickname(name);
    await interaction.reply(`✏️ Updated **${user.tag}** nickname to **${name}**.`);
  }
};
