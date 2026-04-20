const { SlashCommandBuilder } = require('discord.js');
const jokes = [
  'Why did the bot cross the server? To moderate the other side.',
  'I would tell a UDP joke, but you might not get it.',
  'Why do JavaScript developers wear glasses? Because they do not C#.',
  'I told my bot to chill. Now it only responds in cool-downs.'
];
module.exports = { data: new SlashCommandBuilder().setName('joke').setDescription('Tell a random joke.'), async execute(interaction) { await interaction.reply(`😂 ${jokes[Math.floor(Math.random() * jokes.length)]}`); } };
