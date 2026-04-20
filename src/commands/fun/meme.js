const { SlashCommandBuilder } = require('discord.js');
const memes = ['When the ping is 12ms and you feel unstoppable.', 'Me: one more game. Also me: sunrise.', 'That moment when the bot actually works on the first try.'];
module.exports = { data: new SlashCommandBuilder().setName('meme').setDescription('Get a text meme.'), async execute(interaction) { await interaction.reply(`📸 ${memes[Math.floor(Math.random() * memes.length)]}`); } };
