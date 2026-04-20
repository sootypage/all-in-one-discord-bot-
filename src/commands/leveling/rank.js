const { SlashCommandBuilder } = require('discord.js');
const { getUser } = require('../../utils/database');
module.exports = { data: new SlashCommandBuilder().setName('rank').setDescription('Check a rank.').addUserOption(o => o.setName('user').setDescription('User to check')), async execute(interaction) { const target = interaction.options.getUser('user') || interaction.user; const user = getUser(interaction.guild.id, target.id); const needed = user.level * 100; await interaction.reply(`📈 ${target.username} is level **${user.level}** with **${user.xp}/${needed} XP**.`); } };
