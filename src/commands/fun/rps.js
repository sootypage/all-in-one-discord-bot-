const { SlashCommandBuilder } = require('discord.js');
const choices = ['rock', 'paper', 'scissors'];
module.exports = {
  data: new SlashCommandBuilder().setName('rps').setDescription('Play rock paper scissors.').addStringOption(o => o.setName('choice').setDescription('Your choice').setRequired(true).addChoices(...choices.map(c => ({ name: c, value: c })))),
  async execute(interaction) {
    const userChoice = interaction.options.getString('choice');
    const botChoice = choices[Math.floor(Math.random() * choices.length)];
    let result = 'It is a draw.';
    if (userChoice !== botChoice) {
      const win = (userChoice === 'rock' && botChoice === 'scissors') || (userChoice === 'paper' && botChoice === 'rock') || (userChoice === 'scissors' && botChoice === 'paper');
      result = win ? 'You win!' : 'You lose!';
    }
    await interaction.reply(`You picked **${userChoice}**. I picked **${botChoice}**. ${result}`);
  }
};
