const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rate')
    .setDescription('Rate anything out of 10.')
    .addStringOption(option => option.setName('thing').setDescription('What should I rate?').setRequired(true)),
  async execute(interaction) {
    const thing = interaction.options.getString('thing', true);
    const rating = Math.floor(Math.random() * 10) + 1;
    const extras = [
      'Pretty solid.',
      'That is interesting.',
      'Could be better.',
      'Top tier.',
      'That is actually kind of fun.',
      'Not bad at all.'
    ];
    const extra = extras[Math.floor(Math.random() * extras.length)];
    return interaction.reply(`I rate **${thing}** a **${rating}/10**. ${extra}`);
  }
};
