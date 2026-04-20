const { SlashCommandBuilder } = require('discord.js');
const { setVolume } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the music volume')
    .addIntegerOption(option =>
      option
        .setName('percent')
        .setDescription('Volume from 1 to 200')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(200)
    ),

  async execute(interaction) {
    const percent = interaction.options.getInteger('percent', true);
    const volume = setVolume(interaction.guild.id, percent / 100);

    await interaction.reply(`🔊 Volume set to **${Math.round(volume * 100)}%**.`);
  }
};