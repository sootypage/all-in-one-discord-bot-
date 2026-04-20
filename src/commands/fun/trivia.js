const { SlashCommandBuilder } = require('discord.js');

const questions = [
  { q: 'What planet is known as the Red Planet?', a: 'Mars' },
  { q: 'How many sides does a hexagon have?', a: '6' },
  { q: 'What is the capital city of Japan?', a: 'Tokyo' },
  { q: 'What gas do plants absorb from the air?', a: 'Carbon dioxide' },
  { q: 'How many minutes are in one hour?', a: '60' }
];

module.exports = {
  data: new SlashCommandBuilder().setName('trivia').setDescription('Get a random trivia question.'),
  async execute(interaction) {
    const item = questions[Math.floor(Math.random() * questions.length)];
    return interaction.reply(`**Trivia**\n**Question:** ${item.q}\n**Answer:** ||${item.a}||`);
  }
};
