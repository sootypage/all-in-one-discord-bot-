const { SlashCommandBuilder } = require('discord.js');
const { resumeMusic, getQueue } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the paused song'),

  async execute(interaction) {
    const queue = getQueue(interaction.guild.id);

    if (!queue.current) {
      return interaction.reply({
        content: 'Nothing is loaded right now.',
        ephemeral: true
      });
    }

    const ok = resumeMusic(interaction.guild.id);

    if (!ok) {
      return interaction.reply({
        content: 'Could not resume the music.',
        ephemeral: true
      });
    }

    await interaction.reply(`▶️ Resumed **${queue.current.title}**.`);
  }
};