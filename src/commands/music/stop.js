const { SlashCommandBuilder } = require('discord.js');
const { stopMusic } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the music and clear the queue'),

  async execute(interaction) {
    stopMusic(interaction.guild.id);
    await interaction.reply('⏹️ Stopped the music and cleared the queue.');
  }
};
