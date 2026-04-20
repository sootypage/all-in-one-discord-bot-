const { SlashCommandBuilder } = require('discord.js');
const { addXp } = require('../../utils/database');

const cooldowns = new Map();
const COOLDOWN_MS = 1000 * 60 * 60 * 12;
const REP_XP = 25;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Give someone a little XP boost for being helpful.')
    .addUserOption(option => option.setName('user').setDescription('User to rep').setRequired(true)),
  async execute(interaction) {
    const target = interaction.options.getUser('user', true);
    if (target.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot give rep to yourself.', ephemeral: true });
    }

    const key = `${interaction.guild.id}:${interaction.user.id}`;
    const now = Date.now();
    const last = cooldowns.get(key) || 0;
    if (now - last < COOLDOWN_MS) {
      const minutes = Math.ceil((COOLDOWN_MS - (now - last)) / 60000);
      return interaction.reply({ content: `You can use /rep again in about **${minutes} minutes**.`, ephemeral: true });
    }

    cooldowns.set(key, now);
    const updated = addXp(interaction.guild.id, target.id, REP_XP);
    return interaction.reply(`${interaction.user} gave ${target} **+${REP_XP} XP** for being helpful. They are now level **${updated.level}**.`);
  }
};
