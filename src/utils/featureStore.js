const fs = require('fs');
const { Pool } = require('pg');
const { EmbedBuilder } = require('discord.js');

const pool = new Pool(buildPgConfig());

function buildPgConfig() {
  const cfg = {
    connectionString: process.env.DATABASE_URL
  };

  if (String(process.env.DATABASE_SSL || 'false') === 'true') {
    const ssl = {
      rejectUnauthorized: String(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || 'true') === 'true'
    };

    if (process.env.PGSSL_CA_PATH && fs.existsSync(process.env.PGSSL_CA_PATH)) {
      ssl.ca = fs.readFileSync(process.env.PGSSL_CA_PATH, 'utf8');
    } else if (process.env.PGSSL_CA) {
      ssl.ca = process.env.PGSSL_CA.replace(/\\n/g, '\n');
    }

    cfg.ssl = ssl;
  }

  return cfg;
}

async function initFeatureStore() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reaction_roles (
      guild_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      role_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (guild_id, message_id, emoji)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS giveaways (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      host_id TEXT NOT NULL,
      prize TEXT NOT NULL,
      winner_count INTEGER NOT NULL DEFAULT 1,
      ends_at BIGINT NOT NULL,
      ended BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS giveaway_entries (
      giveaway_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (giveaway_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS automod_settings (
      guild_id TEXT PRIMARY KEY,
      antilink_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      antiinvite_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      antispam_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      antibadwords_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      antispam_limit INTEGER NOT NULL DEFAULT 6,
      antispam_window_ms INTEGER NOT NULL DEFAULT 10000,
      antispam_timeout_minutes INTEGER NOT NULL DEFAULT 10,
      modlog_channel_id TEXT
    );
  `);

  await pool.query(`
    ALTER TABLE automod_settings
    ADD COLUMN IF NOT EXISTS antibadwords_enabled BOOLEAN NOT NULL DEFAULT FALSE
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS spam_trackers (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      timestamps JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (guild_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bad_words (
      guild_id TEXT NOT NULL,
      word TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (guild_id, word)
    );
  `);
}

async function setReactionRole(guildId, messageId, emoji, roleId) {
  await pool.query(
    `
      INSERT INTO reaction_roles (guild_id, message_id, emoji, role_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (guild_id, message_id, emoji)
      DO UPDATE SET role_id = EXCLUDED.role_id;
    `,
    [guildId, messageId, emoji, roleId]
  );
}

async function removeReactionRole(guildId, messageId, emoji) {
  await pool.query(
    `DELETE FROM reaction_roles WHERE guild_id = $1 AND message_id = $2 AND emoji = $3`,
    [guildId, messageId, emoji]
  );
}

async function getReactionRole(guildId, messageId, emoji) {
  const { rows } = await pool.query(
    `SELECT * FROM reaction_roles WHERE guild_id = $1 AND message_id = $2 AND emoji = $3 LIMIT 1`,
    [guildId, messageId, emoji]
  );
  return rows[0] || null;
}

async function listReactionRoles(guildId) {
  const { rows } = await pool.query(
    `SELECT * FROM reaction_roles WHERE guild_id = $1 ORDER BY created_at DESC`,
    [guildId]
  );
  return rows;
}

async function createGiveaway(data) {
  await pool.query(
    `
      INSERT INTO giveaways (id, guild_id, channel_id, message_id, host_id, prize, winner_count, ends_at, ended)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE)
    `,
    [
      data.id,
      data.guild_id,
      data.channel_id,
      data.message_id,
      data.host_id,
      data.prize,
      data.winner_count,
      data.ends_at
    ]
  );
}

async function getGiveaway(id) {
  const { rows } = await pool.query(`SELECT * FROM giveaways WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] || null;
}

async function getActiveGiveawaysToEnd(now = Date.now()) {
  const { rows } = await pool.query(
    `SELECT * FROM giveaways WHERE ended = FALSE AND ends_at <= $1 ORDER BY ends_at ASC`,
    [now]
  );
  return rows;
}

async function getRecentGiveaways(guildId) {
  const { rows } = await pool.query(
    `SELECT * FROM giveaways WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 25`,
    [guildId]
  );
  return rows;
}

async function enterGiveaway(giveawayId, userId) {
  await pool.query(
    `
      INSERT INTO giveaway_entries (giveaway_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (giveaway_id, user_id) DO NOTHING
    `,
    [giveawayId, userId]
  );
}

async function getGiveawayEntries(giveawayId) {
  const { rows } = await pool.query(
    `SELECT user_id FROM giveaway_entries WHERE giveaway_id = $1 ORDER BY created_at ASC`,
    [giveawayId]
  );
  return rows.map(r => r.user_id);
}

async function markGiveawayEnded(giveawayId) {
  await pool.query(`UPDATE giveaways SET ended = TRUE WHERE id = $1`, [giveawayId]);
}

async function ensureAutomodRow(guildId) {
  await pool.query(
    `INSERT INTO automod_settings (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`,
    [guildId]
  );
}

async function getAutomodSettings(guildId) {
  await ensureAutomodRow(guildId);
  const { rows } = await pool.query(`SELECT * FROM automod_settings WHERE guild_id = $1 LIMIT 1`, [guildId]);
  return rows[0];
}

async function setAutomodSetting(guildId, key, value) {
  const allowed = new Set([
    'antilink_enabled',
    'antiinvite_enabled',
    'antispam_enabled',
    'antibadwords_enabled',
    'antispam_limit',
    'antispam_window_ms',
    'antispam_timeout_minutes',
    'modlog_channel_id'
  ]);

  if (!allowed.has(key)) {
    throw new Error(`Invalid automod setting: ${key}`);
  }

  await ensureAutomodRow(guildId);
  await pool.query(`UPDATE automod_settings SET ${key} = $2 WHERE guild_id = $1`, [guildId, value]);
}

async function addBadWord(guildId, word) {
  await pool.query(
    `INSERT INTO bad_words (guild_id, word) VALUES ($1, $2) ON CONFLICT (guild_id, word) DO NOTHING`,
    [guildId, String(word).toLowerCase().trim()]
  );
}

async function removeBadWord(guildId, word) {
  await pool.query(
    `DELETE FROM bad_words WHERE guild_id = $1 AND word = $2`,
    [guildId, String(word).toLowerCase().trim()]
  );
}

async function getBadWords(guildId) {
  const { rows } = await pool.query(
    `SELECT word FROM bad_words WHERE guild_id = $1 ORDER BY word ASC`,
    [guildId]
  );
  return rows;
}

async function getSpamTracker(guildId, userId) {
  const { rows } = await pool.query(
    `SELECT timestamps FROM spam_trackers WHERE guild_id = $1 AND user_id = $2 LIMIT 1`,
    [guildId, userId]
  );
  return rows[0] || { timestamps: [] };
}

async function setSpamTracker(guildId, userId, timestamps) {
  await pool.query(
    `
      INSERT INTO spam_trackers (guild_id, user_id, timestamps, updated_at)
      VALUES ($1, $2, $3::jsonb, NOW())
      ON CONFLICT (guild_id, user_id)
      DO UPDATE SET timestamps = EXCLUDED.timestamps, updated_at = NOW()
    `,
    [guildId, userId, JSON.stringify(timestamps)]
  );
}

async function clearSpamTracker(guildId, userId) {
  await pool.query(`DELETE FROM spam_trackers WHERE guild_id = $1 AND user_id = $2`, [guildId, userId]);
}

async function sendModLog(client, guildId, options) {
  const config = await getAutomodSettings(guildId);
  if (!config?.modlog_channel_id) return;

  const channel = await client.channels.fetch(config.modlog_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(options.title || 'Moderation Log')
    .setDescription(options.description || 'No description provided.')
    .setColor(options.color || 0xffaa00)
    .setTimestamp(new Date());

  if (Array.isArray(options.fields)) {
    embed.addFields(options.fields);
  }

  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  pool,
  initFeatureStore,
  setReactionRole,
  removeReactionRole,
  getReactionRole,
  listReactionRoles,
  createGiveaway,
  getGiveaway,
  getActiveGiveawaysToEnd,
  getRecentGiveaways,
  enterGiveaway,
  getGiveawayEntries,
  markGiveawayEnded,
  getAutomodSettings,
  setAutomodSetting,
  addBadWord,
  removeBadWord,
  getBadWords,
  getSpamTracker,
  setSpamTracker,
  clearSpamTracker,
  sendModLog
};