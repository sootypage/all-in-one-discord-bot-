const { SlashCommandBuilder } = require('discord.js');
const { pauseMusic, getQueue } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current song'),

  async execute(interaction) {
    const queue = getQueue(interaction.guild.id);

    if (!queue.current) {
      return interaction.reply({
        content: 'Nothing is playing right now.',
        ephemeral: true
      });
    }

    const ok = pauseMusic(interaction.guild.id);

    if (!ok) {
      return interaction.reply({
        content: 'Could not pause the music.',
        ephemeral: true
      });
    }

    await interaction.reply(`⏸️ Paused **${queue.current.title}**.`);
  }
};