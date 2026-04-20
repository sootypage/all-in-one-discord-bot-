const { SlashCommandBuilder } = require('discord.js');
const { resumeMusic } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the paused song'),

  async execute(interaction) {
    const ok = resumeMusic(interaction.guild.id);

    if (!ok) {
      return interaction.reply({ content: 'Nothing is paused right now.', ephemeral: true });
    }

    await interaction.reply('▶️ Resumed the music.');
  }
};