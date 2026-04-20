const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');

const { postGiveaway, endGiveaway } = require('../../utils/giveaways');
const { getRecentGiveaways } = require('../../utils/featureStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Start a giveaway')
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Channel to post in').setRequired(true))
        .addStringOption(opt =>
          opt.setName('prize').setDescription('Giveaway prize').setRequired(true))
        .addIntegerOption(opt =>
          opt.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1))
        .addIntegerOption(opt =>
          opt.setName('winners').setDescription('Winner count').setRequired(false).setMinValue(1)))
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription('End a giveaway now')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Giveaway ID').setRequired(true)))
    .addSubcommand(sub =>
      sub
        .setName('reroll')
        .setDescription('Reroll winners')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Giveaway ID').setRequired(true)))
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List recent giveaways')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const channel = interaction.options.getChannel('channel', true);
      const prize = interaction.options.getString('prize', true);
      const minutes = interaction.options.getInteger('minutes', true);
      const winners = interaction.options.getInteger('winners') || 1;

      const giveawayId = await postGiveaway({
        channel,
        hostId: interaction.user.id,
        prize,
        winnerCount: winners,
        durationMs: minutes * 60 * 1000
      });

      return interaction.reply({
        content: `Giveaway started in ${channel}. ID: \`${giveawayId}\``,
        ephemeral: true
      });
    }

    if (sub === 'end') {
      const id = interaction.options.getString('id', true);
      const result = await endGiveaway(interaction.client, id, false);

      return interaction.reply({
        content: result ? `Giveaway \`${id}\` ended.` : 'Giveaway not found.',
        ephemeral: true
      });
    }

    if (sub === 'reroll') {
      const id = interaction.options.getString('id', true);
      const result = await endGiveaway(interaction.client, id, true);

      return interaction.reply({
        content: result ? `Giveaway \`${id}\` rerolled.` : 'Giveaway not found.',
        ephemeral: true
      });
    }

    const giveaways = await getRecentGiveaways(interaction.guild.id);

    if (!giveaways.length) {
      return interaction.reply({ content: 'No giveaways found.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Recent Giveaways')
      .setColor(0xf1c40f)
      .setDescription(
        giveaways
          .map(g => `ID: \`${g.id}\` | Prize: **${g.prize}** | Ended: **${g.ended ? 'Yes' : 'No'}**`)
          .join('\n')
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};