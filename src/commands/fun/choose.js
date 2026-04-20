const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('choose')
    .setDescription('Let the bot choose between options for you.')
    .addStringOption(option =>
      option.setName('options')
        .setDescription('Separate choices with commas, for example: pizza, burgers, tacos')
        .setRequired(true)
    ),
  async execute(interaction) {
    const raw = interaction.options.getString('options', true);
    const choices = raw.split(',').map(choice => choice.trim()).filter(Boolean);
    if (choices.length < 2) {
      return interaction.reply({ content: 'Give me at least 2 options separated by commas.', ephemeral: true });
    }
    const picked = choices[Math.floor(Math.random() * choices.length)];
    return interaction.reply(`I choose: **${picked}**`);
  }
};
