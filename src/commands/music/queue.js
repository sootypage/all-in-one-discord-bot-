const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current music queue'),

  async execute(interaction) {
    const queue = getQueue(interaction.guild.id);

    if (!queue.songs.length) {
      return interaction.reply({ content: 'The queue is empty.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Music Queue')
      .setDescription(
        queue.songs
          .slice(0, 10)
          .map((song, index) => `${index === 0 ? '🎶' : `${index}.`} **${song.title}**`)
          .join('\n')
      )
      .setColor(0x5865f2);

    await interaction.reply({ embeds: [embed] });
  }
};