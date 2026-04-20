const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addBadWord, removeBadWord, getBadWords } = require('../../utils/featureStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('badwords')
    .setDescription('Manage blocked words')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a blocked word')
        .addStringOption(opt =>
          opt.setName('word').setDescription('Word to block').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a blocked word')
        .addStringOption(opt =>
          opt.setName('word').setDescription('Word to remove').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List blocked words')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'add') {
      const word = interaction.options.getString('word', true).trim().toLowerCase();
      await addBadWord(guildId, word);
      return interaction.reply({ content: `Added blocked word: \`${word}\``, ephemeral: true });
    }

    if (sub === 'remove') {
      const word = interaction.options.getString('word', true).trim().toLowerCase();
      await removeBadWord(guildId, word);
      return interaction.reply({ content: `Removed blocked word: \`${word}\``, ephemeral: true });
    }

    const words = await getBadWords(guildId);

    if (!words.length) {
      return interaction.reply({ content: 'No blocked words set.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Blocked Words')
      .setColor(0xe74c3c)
      .setDescription(words.map(w => `• \`${w.word}\``).join('\n').slice(0, 4000));

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};