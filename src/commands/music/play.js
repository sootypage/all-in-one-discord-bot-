const { SlashCommandBuilder } = require('discord.js');
const { addSong } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Song name or YouTube URL')
        .setRequired(true)
    ),

  async execute(interaction) {
    const query = interaction.options.getString('query', true);

    await interaction.deferReply();

    try {
      const result = await addSong(interaction, query);

      if (result.started) {
        await interaction.editReply(
          `▶️ Now playing: **${result.song.title}**\n${result.song.url}`
        );
      } else {
        await interaction.editReply(
          `➕ Added to queue: **${result.song.title}**\n${result.song.url}`
        );
      }
    } catch (error) {
      console.error('Play command failed:', error);
      await interaction.editReply(`❌ ${error.message || 'Failed to play that song.'}`);
    }
  }
};