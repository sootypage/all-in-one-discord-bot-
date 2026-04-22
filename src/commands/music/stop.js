const { SlashCommandBuilder } = require('discord.js');
const { stopMusic, getQueue } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the music and clear the queue'),

  async execute(interaction) {
    const queue = getQueue(interaction.guild.id);

    if (!queue.songs.length) {
      return interaction.reply({
        content: 'There is nothing playing.',
        ephemeral: true
      });
    }

    stopMusic(interaction.guild.id);

    await interaction.reply('⏹️ Stopped the music and cleared the queue.');
  }
};