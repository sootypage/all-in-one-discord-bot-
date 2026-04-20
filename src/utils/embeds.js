const { EmbedBuilder } = require('discord.js');

function baseEmbed(title, description) {
  return new EmbedBuilder().setTitle(title).setDescription(description).setTimestamp();
}

module.exports = { baseEmbed };
