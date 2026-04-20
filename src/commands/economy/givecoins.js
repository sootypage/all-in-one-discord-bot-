const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { addBalance } = require('../../utils/database');
module.exports = {
  data: new SlashCommandBuilder().setName('givecoins').setDescription('Give coins to a user.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)),
  async execute(interaction) { const user = interaction.options.getUser('user'); const amount = interaction.options.getInteger('amount'); addBalance(interaction.guild.id, user.id, amount); await interaction.reply(`Added **${amount}** coins to **${user.username}**.`); }
};
