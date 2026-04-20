const { SlashCommandBuilder } = require('discord.js');
const { pauseMusic } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current song'),

  async execute(interaction) {
    const ok = pauseMusic(interaction.guild.id);

    if (!ok) {
      return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
    }

    await interaction.reply('⏸️ Paused the music.');
  }
};