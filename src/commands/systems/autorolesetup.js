const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { updateGuildSettings } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorolesetup')
    .setDescription('Set the role new members get when they join.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption(o => o.setName('role').setDescription('Auto role').setRequired(true)),
  async execute(interaction) {
    const role = interaction.options.getRole('role', true);
    updateGuildSettings(interaction.guild.id, { auto_role_enabled: 1, auto_role_id: role.id });
    await interaction.reply({ content: `✅ Auto role enabled. New members will get ${role}.`, ephemeral: true });
  }
};
