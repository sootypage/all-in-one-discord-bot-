const { SlashCommandBuilder } = require('discord.js');
const { skipSong } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),

  async execute(interaction) {
    const skipped = skipSong(interaction.guild.id);

    if (!skipped) {
      return interaction.reply({ content: 'There is nothing playing.', ephemeral: true });
    }

    await interaction.reply('⏭️ Skipped the current song.');
  }
};