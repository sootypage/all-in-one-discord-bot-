const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show bot commands'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Bot Help')
      .setColor(0x5865f2)
      .setDescription('Here are the main command groups.')
      .addFields(
        {
          name: 'Moderation',
          value: [
            '`/ban` `/kick` `/timeout` `/untimeout` `/warn` `/warnings`',
            '`/clear` `/lock` `/unlock` `/slowmode` `/nickname` `/role`',
            '`/unban` `/modlogs` `/antilink` `/antiinvite` `/antispam`',
            '`/antibadwords` `/badwords`'
          ].join('\n')
        },
        {
          name: 'Economy',
          value: [
            '`/balance` `/daily` `/weekly` `/work` `/crime` `/rob`',
            '`/pay` `/deposit` `/withdraw` `/shop` `/buy` `/inventory`',
            '`/richest` `/givecoins` `/addshopitem` `/economyconfig`'
          ].join('\n')
        },
        {
          name: 'Leveling',
          value: '`/rank` `/leaderboard` `/profile` `/rep` `/addxp` `/levelconfig`'
        },
        {
          name: 'Fun',
          value: '`/ping` `/coinflip` `/8ball` `/dice` `/rps` `/joke` `/meme` `/choose` `/rate` `/trivia` `/compliment`'
        },
        {
          name: 'Tickets / Utility',
          value: '`/setuptickets` `/ticketpanel` `/reactionroles` `/tempvcconfig` `/help`'
        },
        {
          name: 'Giveaways',
          value: '`/giveaway start` `/giveaway end` `/giveaway reroll` `/giveaway list`'
        },
        {
          name: 'Alerts',
          value: '`/youtubealerts` `/twitchalerts` `/githubalerts`'
        },
        {
          name: 'Config',
          value: '`/setconfig`'
        }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};