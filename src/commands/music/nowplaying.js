const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the current song'),

  async execute(interaction) {
    const queue = getQueue(interaction.guild.id);

    if (!queue.current) {
      return interaction.reply({
        content: 'Nothing is playing right now.',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('Now Playing')
      .setColor(0x2ecc71)
      .setDescription(`🎵 **${queue.current.title}**`)
      .addFields(
        { name: 'Duration', value: queue.current.duration || 'Unknown', inline: true },
        { name: 'Requested By', value: `<@${queue.current.requestedBy}>`, inline: true }
      );

    if (queue.current.url) {
      embed.addFields({
        name: 'Link',
        value: queue.current.url
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
};