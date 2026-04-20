const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');

const {
  setReactionRole,
  removeReactionRole,
  listReactionRoles
} = require('../../utils/featureStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionroles')
    .setDescription('Manage reaction roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a reaction role')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('Message ID').setRequired(true))
        .addStringOption(opt =>
          opt.setName('emoji').setDescription('Emoji, like ✅ or emoji ID').setRequired(true))
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to give').setRequired(true)))
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a reaction role')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('Message ID').setRequired(true))
        .addStringOption(opt =>
          opt.setName('emoji').setDescription('Emoji, like ✅ or emoji ID').setRequired(true)))
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all reaction roles')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'add') {
      const messageId = interaction.options.getString('message_id', true);
      const emoji = interaction.options.getString('emoji', true);
      const role = interaction.options.getRole('role', true);

      await setReactionRole(guildId, messageId, emoji, role.id);

      return interaction.reply({
        content: `Saved reaction role: message \`${messageId}\`, emoji \`${emoji}\` -> ${role}`,
        ephemeral: true
      });
    }

    if (sub === 'remove') {
      const messageId = interaction.options.getString('message_id', true);
      const emoji = interaction.options.getString('emoji', true);

      await removeReactionRole(guildId, messageId, emoji);

      return interaction.reply({
        content: `Removed reaction role for message \`${messageId}\` and emoji \`${emoji}\`.`,
        ephemeral: true
      });
    }

    const rows = await listReactionRoles(guildId);

    if (!rows.length) {
      return interaction.reply({ content: 'No reaction roles set up yet.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Reaction Roles')
      .setColor(0x5865f2)
      .setDescription(
        rows
          .slice(0, 25)
          .map(r => `Message: \`${r.message_id}\` | Emoji: \`${r.emoji}\` | Role: <@&${r.role_id}>`)
          .join('\n')
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};