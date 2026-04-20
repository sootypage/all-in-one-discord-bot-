const { SlashCommandBuilder } = require('discord.js');

const compliments = [
  'brings great energy to the server.',
  'is doing awesome today.',
  'has elite vibes.',
  'deserves a win today.',
  'is way cooler than they admit.',
  'makes this place better.'
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('compliment')
    .setDescription('Send a nice compliment.')
    .addUserOption(option => option.setName('user').setDescription('Who should get the compliment?').setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const line = compliments[Math.floor(Math.random() * compliments.length)];
    return interaction.reply(`${user} ${line}`);
  }
};
