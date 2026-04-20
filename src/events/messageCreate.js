const { addXp, getGuildConfig } = require('../utils/database');
const {
  getAutomodSettings,
  getSpamTracker,
  setSpamTracker,
  clearSpamTracker,
  sendModLog,
  getBadWords
} = require('../utils/featureStore');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const member = message.member;
    const content = message.content || '';

    const baseConfig = await getGuildConfigSafe(guildId);
    const automod = await getAutomodSettings(guildId);

    if (baseConfig?.leveling_enabled) {
      try {
        await addXp(guildId, message.author.id, 10);
      } catch (error) {
        console.error('XP add failed:', error);
      }
    }

    if (!member || member.permissions.has('ManageMessages')) return;

    if (automod.antilink_enabled && /(https?:\/\/\S+)/i.test(content)) {
      await deleteAndWarn(message, 'Links are not allowed here.');
      await sendModLog(client, guildId, {
        title: 'AutoMod: Link Blocked',
        description: `${message.author} sent a blocked link in ${message.channel}.`,
        fields: [
          { name: 'User ID', value: message.author.id, inline: true },
          { name: 'Message', value: truncate(content), inline: false }
        ]
      });
      return;
    }

    if (automod.antiinvite_enabled && /(discord\.gg\/|discord\.com\/invite\/)/i.test(content)) {
      await deleteAndWarn(message, 'Discord invites are not allowed here.');
      await sendModLog(client, guildId, {
        title: 'AutoMod: Invite Blocked',
        description: `${message.author} sent a blocked invite in ${message.channel}.`,
        fields: [
          { name: 'User ID', value: message.author.id, inline: true },
          { name: 'Message', value: truncate(content), inline: false }
        ]
      });
      return;
    }

    if (automod.antibadwords_enabled) {
      const badWords = await getBadWords(guildId);
      const matchedWord = findMatchedBadWord(content, badWords);

      if (matchedWord) {
        await deleteAndWarn(message, 'That word is not allowed here.');
        await sendModLog(client, guildId, {
          title: 'AutoMod: Bad Word Blocked',
          description: `${message.author} used a blocked word in ${message.channel}.`,
          fields: [
            { name: 'User ID', value: message.author.id, inline: true },
            { name: 'Matched Word', value: matchedWord, inline: true },
            { name: 'Message', value: truncate(content), inline: false }
          ]
        });
        return;
      }
    }

    if (automod.antispam_enabled) {
      const tracker = await getSpamTracker(guildId, message.author.id);
      const now = Date.now();
      const timestamps = Array.isArray(tracker.timestamps) ? tracker.timestamps : [];
      const recent = timestamps.filter(ts => now - ts <= automod.antispam_window_ms);
      recent.push(now);

      await setSpamTracker(guildId, message.author.id, recent);

      if (recent.length >= automod.antispam_limit) {
        try {
          await message.channel.bulkDelete(
            (await message.channel.messages.fetch({ limit: 25 }))
              .filter(m => m.author.id === message.author.id && (now - m.createdTimestamp) <= automod.antispam_window_ms),
            true
          );
        } catch {}

        if (automod.antispam_timeout_minutes > 0 && member.moderatable) {
          try {
            await member.timeout(automod.antispam_timeout_minutes * 60 * 1000, 'AutoMod spam protection');
          } catch {}
        }

        await clearSpamTracker(guildId, message.author.id);

        try {
          await message.channel.send({
            content: `${message.author}, please stop spamming.`,
            allowedMentions: { users: [message.author.id] }
          });
        } catch {}

        await sendModLog(client, guildId, {
          title: 'AutoMod: Spam Triggered',
          description: `${message.author} triggered anti-spam in ${message.channel}.`,
          fields: [
            { name: 'User ID', value: message.author.id, inline: true },
            { name: 'Messages In Window', value: String(recent.length), inline: true }
          ]
        });
      }
    }
  }
};

async function deleteAndWarn(message, warning) {
  try {
    await message.delete();
  } catch {}

  try {
    await message.channel.send({
      content: `${message.author}, ${warning}`,
      allowedMentions: { users: [message.author.id] }
    });
  } catch {}
}

async function getGuildConfigSafe(guildId) {
  try {
    return await getGuildConfig(guildId);
  } catch {
    return null;
  }
}

function findMatchedBadWord(content, badWords) {
  const lower = String(content || '').toLowerCase();
  for (const word of badWords) {
    const escaped = escapeRegex(word.word || word);
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(lower)) return word.word || word;
  }
  return null;
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function truncate(text, max = 1000) {
  if (!text) return 'No content';
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}