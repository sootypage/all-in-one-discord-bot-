const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current music queue'),

  async execute(interaction) {
    const queue = getQueue(interaction.guild.id);

    if (!queue.songs.length && !queue.current) {
      return interaction.reply({
        content: 'The queue is empty.',
        ephemeral: true
      });
    }

    const lines = [];

    if (queue.current) {
      lines.push(`**Now Playing:**\n🎶 **${queue.current.title}** \`[${queue.current.duration || 'Unknown'}]\``);
    }

    const upcoming = queue.songs.slice(queue.current ? 1 : 0, (queue.current ? 1 : 0) + 10);

    if (upcoming.length) {
      lines.push(
        '**Up Next:**\n' +
        upcoming
          .map((song, index) => `${index + 1}. **${song.title}** \`[${song.duration || 'Unknown'}]\``)
          .join('\n')
      );
    }

    const embed = new EmbedBuilder()
      .setTitle('Music Queue')
      .setColor(0x5865f2)
      .setDescription(lines.join('\n\n'))
      .setFooter({
        text: `Total queued: ${queue.songs.length}`
      });

    await interaction.reply({ embeds: [embed] });
  }
};