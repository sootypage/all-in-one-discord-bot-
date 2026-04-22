const { SlashCommandBuilder } = require('discord.js');
const { skipSong, getQueue } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),

  async execute(interaction) {
    const queue = getQueue(interaction.guild.id);

    if (!queue.songs.length) {
      return interaction.reply({
        content: 'There is nothing playing.',
        ephemeral: true
      });
    }

    const currentTitle = queue.current?.title || queue.songs[0]?.title || 'the current song';
    const skipped = skipSong(interaction.guild.id);

    if (!skipped) {
      return interaction.reply({
        content: 'There is nothing playing.',
        ephemeral: true
      });
    }

    await interaction.reply(`⏭️ Skipped **${currentTitle}**.`);
  }
};