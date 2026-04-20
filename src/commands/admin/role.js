const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove a role from a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add a role')
      .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
      .addRoleOption(option => option.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a role')
      .addUserOption(option => option.setName('user').setDescription('User').setRequired(true))
      .addRoleOption(option => option.setName('role').setDescription('Role').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
    if (!member.manageable) return interaction.reply({ content: 'I cannot manage that user.', ephemeral: true });

    if (sub === 'add') {
      await member.roles.add(role);
      await interaction.reply(`➕ Added ${role} to **${user.tag}**.`);
    } else {
      await member.roles.remove(role);
      await interaction.reply(`➖ Removed ${role} from **${user.tag}**.`);
    }
  }
};
