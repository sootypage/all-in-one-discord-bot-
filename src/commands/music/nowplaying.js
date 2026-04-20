const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the current song'),

  async execute(interaction) {
    const queue = getQueue(interaction.guild.id);

    if (!queue.current) {
      return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
    }

    await interaction.reply(
      `🎵 Now playing: **${queue.current.title}**\n${queue.current.url}`
    );
  }
};