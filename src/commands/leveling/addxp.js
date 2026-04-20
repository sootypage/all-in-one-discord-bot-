const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { addXp } = require('../../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addxp')
    .setDescription('Give XP to a user.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(option => option.setName('user').setDescription('User to reward').setRequired(true))
    .addIntegerOption(option => option.setName('amount').setDescription('Amount of XP').setRequired(true).setMinValue(1).setMaxValue(10000)),
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const updated = addXp(interaction.guild.id, user.id, amount);
    return interaction.reply(`${user} gained **${amount} XP** and is now level **${updated.level}** with **${updated.xp} XP** into the current level.`);
  }
};
