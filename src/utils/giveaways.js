const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const crypto = require('crypto');
const {
  createGiveaway,
  getGiveaway,
  getActiveGiveawaysToEnd,
  getGiveawayEntries,
  markGiveawayEnded,
  enterGiveaway
} = require('./featureStore');

function makeGiveawayId() {
  return crypto.randomBytes(8).toString('hex');
}

async function postGiveaway({ channel, hostId, prize, winnerCount, durationMs }) {
  const endsAt = Date.now() + durationMs;
  const giveawayId = makeGiveawayId();

  const embed = buildGiveawayEmbed({
    prize,
    hostId,
    winnerCount,
    endsAt,
    ended: false
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_join:${giveawayId}`)
      .setLabel('Enter Giveaway')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`giveaway_info:${giveawayId}`)
      .setLabel('Info')
      .setStyle(ButtonStyle.Secondary)
  );

  const message = await channel.send({
    embeds: [embed],
    components: [row]
  });

  await createGiveaway({
    id: giveawayId,
    guild_id: channel.guild.id,
    channel_id: channel.id,
    message_id: message.id,
    host_id: hostId,
    prize,
    winner_count: winnerCount,
    ends_at: endsAt
  });

  return giveawayId;
}

function buildGiveawayEmbed({ prize, hostId, winnerCount, endsAt, ended, winners = [] }) {
  const embed = new EmbedBuilder()
    .setTitle(ended ? '🎉 Giveaway Ended' : '🎉 Giveaway')
    .setColor(ended ? 0x2ecc71 : 0xf1c40f)
    .addFields(
      { name: 'Prize', value: prize, inline: false },
      { name: 'Host', value: `<@${hostId}>`, inline: true },
      { name: 'Winners', value: String(winnerCount), inline: true },
      { name: ended ? 'Ended' : 'Ends', value: `<t:${Math.floor(endsAt / 1000)}:F>`, inline: false }
    )
    .setTimestamp(new Date());

  if (ended) {
    embed.addFields({
      name: 'Result',
      value: winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'No valid entries',
      inline: false
    });
  }

  return embed;
}

async function handleGiveawayButton(interaction) {
  const [action, giveawayId] = interaction.customId.split(':');
  if (action !== 'giveaway_join' && action !== 'giveaway_info') return false;

  const giveaway = await getGiveaway(giveawayId);
  if (!giveaway) {
    await interaction.reply({ content: 'That giveaway no longer exists.', ephemeral: true });
    return true;
  }

  if (action === 'giveaway_info') {
    const entries = await getGiveawayEntries(giveawayId);
    await interaction.reply({
      content:
        `Prize: **${giveaway.prize}**\n` +
        `Ends: <t:${Math.floor(giveaway.ends_at / 1000)}:F>\n` +
        `Entries: **${entries.length}**\n` +
        `Ended: **${giveaway.ended ? 'Yes' : 'No'}**`,
      ephemeral: true
    });
    return true;
  }

  if (giveaway.ended) {
    await interaction.reply({ content: 'This giveaway has already ended.', ephemeral: true });
    return true;
  }

  await enterGiveaway(giveawayId, interaction.user.id);
  await interaction.reply({ content: 'You entered the giveaway.', ephemeral: true });
  return true;
}

async function endGiveaway(client, giveawayId, reroll = false) {
  const giveaway = await getGiveaway(giveawayId);
  if (!giveaway) return null;

  const entries = await getGiveawayEntries(giveawayId);
  const uniqueEntries = [...new Set(entries)];
  const winners = pickWinners(uniqueEntries, giveaway.winner_count);

  const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
  if (!channel) return { giveaway, winners };

  const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
  if (message) {
    const endedEmbed = buildGiveawayEmbed({
      prize: giveaway.prize,
      hostId: giveaway.host_id,
      winnerCount: giveaway.winner_count,
      endsAt: giveaway.ends_at,
      ended: true,
      winners
    });

    await message.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});
  }

  if (!reroll) {
    await markGiveawayEnded(giveawayId);
  }

  await channel.send({
    content: winners.length
      ? `🎉 Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**`
      : `No valid entries for **${giveaway.prize}**.`
  }).catch(() => {});

  return { giveaway, winners };
}

function pickWinners(entries, count) {
  const pool = [...entries];
  const winners = [];

  while (pool.length && winners.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    winners.push(pool[index]);
    pool.splice(index, 1);
  }

  return winners;
}

function startGiveawayWatcher(client) {
  setInterval(async () => {
    try {
      const due = await getActiveGiveawaysToEnd(Date.now());
      for (const giveaway of due) {
        await endGiveaway(client, giveaway.id, false);
      }
    } catch (error) {
      console.error('Giveaway watcher error:', error);
    }
  }, 15000);
}

module.exports = {
  postGiveaway,
  handleGiveawayButton,
  endGiveaway,
  startGiveawayWatcher
};