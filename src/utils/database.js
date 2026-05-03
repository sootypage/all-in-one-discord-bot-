const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
const {
  databaseUrl,
  databaseSslEnabled,
  databaseSslRejectUnauthorized,
  databaseSslCa,
  databaseSslCaPath,
  adminUsername,
  adminPassword,
  adminPasswordDefaultValue,
  adminDiscordIds
} = require('../config');

const DEFAULT_SETTINGS = {
  prefix: '!',
  mod_log_channel_id: '',
  tickets_channel_id: '',
  tickets_category_id: '',
  ticket_support_role_id: '',
  ticket_categories_json: '[]',
  temp_vc_create_channel_id: '',
  temp_vc_category_id: '',
  level_up_channel_id: '',
  leveling_enabled: 1,
  economy_enabled: 1,
  daily_amount: 250,
  work_min: 50,
  work_max: 200,
  starter_balance: 0,
  xp_min: 15,
  xp_max: 25,
  xp_cooldown_seconds: 15,
  welcome_enabled: 0,
  welcome_channel_id: '',
  welcome_message: 'Welcome {user} to {server}!',
  leave_enabled: 0,
  leave_channel_id: '',
  leave_message: '{user} left {server}.',
  auto_role_enabled: 0,
  auto_role_id: '',
  verification_enabled: 0,
  verification_role_id: '',
  verification_channel_id: '',
  verification_message: 'Click the button below to verify and get access.',
  log_channel_id: '',
  member_log_enabled: 1,
  message_log_enabled: 1,
  command_log_enabled: 1
};

function readCa() {
  if (databaseSslCa) return databaseSslCa.includes('BEGIN CERTIFICATE') ? databaseSslCa : Buffer.from(databaseSslCa, 'base64').toString('utf8');
  if (databaseSslCaPath && fs.existsSync(databaseSslCaPath)) return fs.readFileSync(databaseSslCaPath, 'utf8');
  return undefined;
}

const ssl = databaseSslEnabled ? {
  rejectUnauthorized: databaseSslRejectUnauthorized,
  ca: readCa()
} : undefined;

const pool = new Pool({
  connectionString: databaseUrl,
  ssl
});

const cache = {
  users: new Map(),
  guildSettings: new Map(),
  tempChannels: new Map(),
  dashboardUsersByDiscordId: new Map(),
  dashboardUsersById: new Map(),
  webSessions: new Map(),
  adminCredentialsById: new Map(),
  adminCredentialsByUsername: new Map(),
  shopItems: new Map(),
  userInventory: new Map(),
  warnings: [],
  contentWatchers: []
};

function userKey(guildId, userId) { return `${guildId}:${userId}`; }
function shopKey(guildId, itemKey) { return `${guildId}:${itemKey}`; }
function inventoryKey(guildId, userId, itemKey) { return `${guildId}:${userId}:${itemKey}`; }

function query(text, params = []) {
  return pool.query(text, params);
}

function background(text, params = []) {
  query(text, params).catch(error => console.error('PostgreSQL background query failed:', error.message));
}

function normalizeRowBooleans(row) {
  if (!row) return row;
  const clone = { ...row };
  for (const key of Object.keys(clone)) {
    if (typeof clone[key] === 'boolean') clone[key] = clone[key] ? 1 : 0;
  }
  return clone;
}

function normalizeGuildSettings(row) {
  const merged = { ...DEFAULT_SETTINGS, ...(row || {}) };
  if (typeof merged.ticket_categories_json !== 'string') merged.ticket_categories_json = '[]';
  return normalizeRowBooleans(merged);
}

async function createSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0,
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      bank INTEGER NOT NULL DEFAULT 0,
      last_daily BIGINT NOT NULL DEFAULT 0,
      last_weekly BIGINT NOT NULL DEFAULT 0,
      last_work BIGINT NOT NULL DEFAULT 0,
      last_crime BIGINT NOT NULL DEFAULT 0,
      last_rob BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      prefix TEXT NOT NULL DEFAULT '!',
      mod_log_channel_id TEXT DEFAULT '',
      tickets_channel_id TEXT DEFAULT '',
      tickets_category_id TEXT DEFAULT '',
      ticket_support_role_id TEXT DEFAULT '',
      ticket_categories_json TEXT NOT NULL DEFAULT '[]',
      temp_vc_create_channel_id TEXT DEFAULT '',
      temp_vc_category_id TEXT DEFAULT '',
      level_up_channel_id TEXT DEFAULT '',
      leveling_enabled INTEGER NOT NULL DEFAULT 1,
      economy_enabled INTEGER NOT NULL DEFAULT 1,
      daily_amount INTEGER NOT NULL DEFAULT 250,
      work_min INTEGER NOT NULL DEFAULT 50,
      work_max INTEGER NOT NULL DEFAULT 200,
      starter_balance INTEGER NOT NULL DEFAULT 0,
      xp_min INTEGER NOT NULL DEFAULT 15,
      xp_max INTEGER NOT NULL DEFAULT 25,
      xp_cooldown_seconds INTEGER NOT NULL DEFAULT 15,
      welcome_enabled INTEGER NOT NULL DEFAULT 0,
      welcome_channel_id TEXT DEFAULT '',
      welcome_message TEXT DEFAULT 'Welcome {user} to {server}!',
      leave_enabled INTEGER NOT NULL DEFAULT 0,
      leave_channel_id TEXT DEFAULT '',
      leave_message TEXT DEFAULT '{user} left {server}.',
      auto_role_enabled INTEGER NOT NULL DEFAULT 0,
      auto_role_id TEXT DEFAULT '',
      verification_enabled INTEGER NOT NULL DEFAULT 0,
      verification_role_id TEXT DEFAULT '',
      verification_channel_id TEXT DEFAULT '',
      verification_message TEXT DEFAULT 'Click the button below to verify and get access.',
      log_channel_id TEXT DEFAULT '',
      member_log_enabled INTEGER NOT NULL DEFAULT 1,
      message_log_enabled INTEGER NOT NULL DEFAULT 1,
      command_log_enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS temp_channels (
      guild_id TEXT NOT NULL,
      channel_id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dashboard_users (
      id BIGSERIAL PRIMARY KEY,
      discord_user_id TEXT UNIQUE,
      username TEXT NOT NULL,
      email TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      access_token TEXT DEFAULT '',
      refresh_token TEXT DEFAULT '',
      token_expires_at BIGINT DEFAULT 0,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_credentials (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      last_login_at BIGINT DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS web_sessions (
      id TEXT PRIMARY KEY,
      dashboard_user_id BIGINT,
      admin_credentials_id BIGINT,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL,
      ip_address TEXT DEFAULT '',
      user_agent TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS shop_items (
      guild_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      item_name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      description TEXT DEFAULT '',
      stock INTEGER NOT NULL DEFAULT -1,
      role_id TEXT DEFAULT '',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (guild_id, item_key)
    );

    CREATE TABLE IF NOT EXISTS user_inventory (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (guild_id, user_id, item_key)
    );

    CREATE TABLE IF NOT EXISTS warnings (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_watchers (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_label TEXT NOT NULL DEFAULT '',
      discord_channel_id TEXT NOT NULL,
      last_seen_id TEXT DEFAULT '',
      last_seen_at BIGINT NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );
  `);

  await query(`
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_enabled INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_channel_id TEXT DEFAULT '';
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS welcome_message TEXT DEFAULT 'Welcome {user} to {server}!';
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS leave_enabled INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS leave_channel_id TEXT DEFAULT '';
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS leave_message TEXT DEFAULT '{user} left {server}.';
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS auto_role_enabled INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS auto_role_id TEXT DEFAULT '';
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS verification_enabled INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS verification_role_id TEXT DEFAULT '';
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS verification_channel_id TEXT DEFAULT '';
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS verification_message TEXT DEFAULT 'Click the button below to verify and get access.';
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS log_channel_id TEXT DEFAULT '';
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS member_log_enabled INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS message_log_enabled INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS command_log_enabled INTEGER NOT NULL DEFAULT 1;
  `);
}

async function preloadCache() {
  for (const [table, mapper] of [
    ['users', row => cache.users.set(userKey(row.guild_id, row.user_id), normalizeRowBooleans(row))],
    ['guild_settings', row => cache.guildSettings.set(row.guild_id, normalizeGuildSettings(row))],
    ['temp_channels', row => cache.tempChannels.set(row.channel_id, row)],
    ['dashboard_users', row => {
      const clean = normalizeRowBooleans(row);
      cache.dashboardUsersById.set(Number(clean.id), clean);
      if (clean.discord_user_id) cache.dashboardUsersByDiscordId.set(clean.discord_user_id, clean);
    }],
    ['admin_credentials', row => {
      const clean = normalizeRowBooleans(row);
      cache.adminCredentialsById.set(Number(clean.id), clean);
      cache.adminCredentialsByUsername.set(clean.username, clean);
    }],
    ['web_sessions', row => cache.webSessions.set(row.id, row)],
    ['shop_items', row => cache.shopItems.set(shopKey(row.guild_id, row.item_key), row)],
    ['user_inventory', row => cache.userInventory.set(inventoryKey(row.guild_id, row.user_id, row.item_key), row)],
    ['warnings', row => cache.warnings.push(row)],
    ['content_watchers', row => cache.contentWatchers.push(normalizeRowBooleans(row))]
  ]) {
    const result = await query(`SELECT * FROM ${table}`);
    result.rows.forEach(mapper);
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

async function ensureAdminCredentials() {
  const existing = cache.adminCredentialsByUsername.get(adminUsername);
  if (existing) return existing;
  const now = Date.now();
  const passwordHash = hashPassword(adminPassword);
  const result = await query(`
    INSERT INTO admin_credentials (username, password_hash, must_change_password, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (username) DO NOTHING
    RETURNING *
  `, [adminUsername, passwordHash, adminPassword === adminPasswordDefaultValue ? 1 : 0, now, now]);
  const row = normalizeRowBooleans(result.rows[0]) || (await query(`SELECT * FROM admin_credentials WHERE username = $1`, [adminUsername])).rows[0];
  const clean = normalizeRowBooleans(row);
  cache.adminCredentialsById.set(Number(clean.id), clean);
  cache.adminCredentialsByUsername.set(clean.username, clean);
  return clean;
}

async function initDatabase() {
  if (!databaseUrl) throw new Error('DATABASE_URL is required for PostgreSQL mode.');
  await createSchema();
  await preloadCache();
  await ensureAdminCredentials();
}

const GUILD_SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

function guildSettingValues(row) {
  return GUILD_SETTING_KEYS.map(key => row[key]);
}

function insertGuildSettingsSql() {
  const columns = ['guild_id', ...GUILD_SETTING_KEYS];
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  return `
    INSERT INTO guild_settings (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (guild_id) DO NOTHING
  `;
}

function upsertGuildSettingsSql() {
  const columns = ['guild_id', ...GUILD_SETTING_KEYS];
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const updates = GUILD_SETTING_KEYS.map(key => `${key} = EXCLUDED.${key}`);
  return `
    INSERT INTO guild_settings (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (guild_id) DO UPDATE SET
      ${updates.join(',\n      ')}
  `;
}

function getGuildSettings(guildId) {
  let row = cache.guildSettings.get(guildId);
  if (!row) {
    row = normalizeGuildSettings({ guild_id: guildId });
    cache.guildSettings.set(guildId, row);
    background(insertGuildSettingsSql(), [guildId, ...guildSettingValues(row)]);
  }
  return { ...row };
}

function updateGuildSettings(guildId, patch) {
  const current = getGuildSettings(guildId);
  const next = normalizeGuildSettings({ ...current, ...patch, guild_id: guildId });
  cache.guildSettings.set(guildId, next);
  background(upsertGuildSettingsSql(), [guildId, ...guildSettingValues(next)]);
  return { ...next };
}

function getUser(guildId, userId) {
  const key = userKey(guildId, userId);
  let row = cache.users.get(key);
  if (!row) {
    const settings = getGuildSettings(guildId);
    row = { guild_id: guildId, user_id: userId, balance: settings.starter_balance, xp: 0, level: 1, bank: 0, last_daily: 0, last_weekly: 0, last_work: 0, last_crime: 0, last_rob: 0 };
    cache.users.set(key, row);
    background(`
      INSERT INTO users (guild_id, user_id, balance, xp, level, bank, last_daily, last_weekly, last_work, last_crime, last_rob)
      VALUES ($1,$2,$3,0,1,0,0,0,0,0,0)
      ON CONFLICT (guild_id, user_id) DO NOTHING
    `, [guildId, userId, settings.starter_balance]);
  }
  return { ...row };
}

function persistUser(row) {
  background(`
    INSERT INTO users (guild_id, user_id, balance, xp, level, bank, last_daily, last_weekly, last_work, last_crime, last_rob)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (guild_id, user_id) DO UPDATE SET
      balance = EXCLUDED.balance,
      xp = EXCLUDED.xp,
      level = EXCLUDED.level,
      bank = EXCLUDED.bank,
      last_daily = EXCLUDED.last_daily,
      last_weekly = EXCLUDED.last_weekly,
      last_work = EXCLUDED.last_work,
      last_crime = EXCLUDED.last_crime,
      last_rob = EXCLUDED.last_rob
  `, [row.guild_id, row.user_id, row.balance, row.xp, row.level, row.bank, row.last_daily, row.last_weekly, row.last_work, row.last_crime, row.last_rob]);
}

function setUserFields(guildId, userId, patch) {
  const current = { ...getUser(guildId, userId), ...patch };
  cache.users.set(userKey(guildId, userId), current);
  persistUser(current);
  return { ...current };
}

function addBalance(guildId, userId, amount) { return setUserFields(guildId, userId, { balance: getUser(guildId, userId).balance + Number(amount || 0) }); }
function addBank(guildId, userId, amount) { return setUserFields(guildId, userId, { bank: Math.max(0, getUser(guildId, userId).bank + Number(amount || 0)) }); }
function setBalance(guildId, userId, amount) { return setUserFields(guildId, userId, { balance: Number(amount || 0) }); }

function transferBalance(guildId, fromUserId, toUserId, amount) {
  amount = Math.max(0, Number(amount || 0));
  const sender = getUser(guildId, fromUserId);
  if (sender.balance < amount) return { ok: false, reason: 'insufficient_funds' };
  addBalance(guildId, fromUserId, -amount);
  addBalance(guildId, toUserId, amount);
  return { ok: true, from: getUser(guildId, fromUserId), to: getUser(guildId, toUserId) };
}

function addXp(guildId, userId, amount) {
  const user = getUser(guildId, userId);
  let xp = user.xp + Number(amount || 0);
  let level = user.level;
  let leveledUp = false;
  while (xp >= level * 100) {
    xp -= level * 100;
    level += 1;
    leveledUp = true;
  }
  const updated = setUserFields(guildId, userId, { xp, level });
  return { ...updated, leveledUp };
}

function setLastDaily(guildId, userId, timestamp) { return setUserFields(guildId, userId, { last_daily: Number(timestamp || 0) }); }
function setLastWeekly(guildId, userId, timestamp) { return setUserFields(guildId, userId, { last_weekly: Number(timestamp || 0) }); }
function setLastWork(guildId, userId, timestamp) { return setUserFields(guildId, userId, { last_work: Number(timestamp || 0) }); }
function setLastCrime(guildId, userId, timestamp) { return setUserFields(guildId, userId, { last_crime: Number(timestamp || 0) }); }
function setLastRob(guildId, userId, timestamp) { return setUserFields(guildId, userId, { last_rob: Number(timestamp || 0) }); }

function transferToBank(guildId, userId, amount) {
  amount = Math.max(0, Number(amount || 0));
  const user = getUser(guildId, userId);
  if (user.balance < amount) return { ok: false, reason: 'insufficient_funds' };
  setUserFields(guildId, userId, { balance: user.balance - amount, bank: user.bank + amount });
  return { ok: true, user: getUser(guildId, userId) };
}

function transferFromBank(guildId, userId, amount) {
  amount = Math.max(0, Number(amount || 0));
  const user = getUser(guildId, userId);
  if (user.bank < amount) return { ok: false, reason: 'insufficient_bank_funds' };
  setUserFields(guildId, userId, { balance: user.balance + amount, bank: user.bank - amount });
  return { ok: true, user: getUser(guildId, userId) };
}

function addWarning(guildId, userId, moderatorId, reason) {
  const row = { id: Date.now() + Math.floor(Math.random() * 1000), guild_id: guildId, user_id: userId, moderator_id: moderatorId, reason, created_at: Date.now() };
  cache.warnings.push(row);
  background(`INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at) VALUES ($1,$2,$3,$4,$5)`, [guildId, userId, moderatorId, reason, row.created_at]);
  return listWarnings(guildId, userId);
}

function listWarnings(guildId, userId) {
  return cache.warnings.filter(w => w.guild_id === guildId && w.user_id === userId).sort((a, b) => b.created_at - a.created_at);
}

function clearWarnings(guildId, userId) {
  cache.warnings = cache.warnings.filter(w => !(w.guild_id === guildId && w.user_id === userId));
  background(`DELETE FROM warnings WHERE guild_id = $1 AND user_id = $2`, [guildId, userId]);
}

function getLeaderboard(guildId, limit = 10) {
  return Array.from(cache.users.values()).filter(u => u.guild_id === guildId).sort((a,b) => (b.level - a.level) || (b.xp - a.xp)).slice(0, limit);
}
function getBalanceLeaderboard(guildId, limit = 10) {
  return Array.from(cache.users.values()).filter(u => u.guild_id === guildId).sort((a,b) => b.balance - a.balance).slice(0, limit);
}

function addTempChannel(guildId, channelId, ownerId) {
  const row = { guild_id: guildId, channel_id: channelId, owner_id: ownerId, created_at: Date.now() };
  cache.tempChannels.set(channelId, row);
  background(`INSERT INTO temp_channels (guild_id, channel_id, owner_id, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (channel_id) DO UPDATE SET guild_id = EXCLUDED.guild_id, owner_id = EXCLUDED.owner_id, created_at = EXCLUDED.created_at`, [guildId, channelId, ownerId, row.created_at]);
}
function getTempChannel(channelId) { return cache.tempChannels.get(channelId) || null; }
function removeTempChannel(channelId) { cache.tempChannels.delete(channelId); background(`DELETE FROM temp_channels WHERE channel_id = $1`, [channelId]); }

function getAdminCredentialByUsername(username) { return cache.adminCredentialsByUsername.get(username) || null; }
function getAdminCredentialById(id) { return cache.adminCredentialsById.get(Number(id)) || null; }

function authenticateAdmin(username, password) {
  const row = getAdminCredentialByUsername(username.trim());
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  const updated = { ...row, last_login_at: Date.now() };
  cache.adminCredentialsById.set(Number(updated.id), updated);
  cache.adminCredentialsByUsername.set(updated.username, updated);
  background(`UPDATE admin_credentials SET last_login_at = $1 WHERE id = $2`, [updated.last_login_at, updated.id]);
  return { id: updated.id, username: updated.username, must_change_password: updated.must_change_password, created_at: updated.created_at, updated_at: updated.updated_at, last_login_at: updated.last_login_at };
}

function changeAdminPassword(adminId, newPassword) {
  const current = getAdminCredentialById(adminId);
  if (!current) return null;
  const updated = { ...current, password_hash: hashPassword(newPassword), must_change_password: 0, updated_at: Date.now() };
  cache.adminCredentialsById.set(Number(updated.id), updated);
  cache.adminCredentialsByUsername.set(updated.username, updated);
  background(`UPDATE admin_credentials SET password_hash = $1, must_change_password = 0, updated_at = $2 WHERE id = $3`, [updated.password_hash, updated.updated_at, updated.id]);
  return { id: updated.id, username: updated.username, must_change_password: updated.must_change_password };
}

function getDashboardUserByDiscordId(discordUserId) { return cache.dashboardUsersByDiscordId.get(discordUserId) || null; }
function getDashboardUserById(id) { return cache.dashboardUsersById.get(Number(id)) || null; }

function upsertDiscordDashboardUser({ discordUser, tokenData, isAdmin = false }) {
  const now = Date.now();
  const expiresAt = tokenData.expires_in ? now + (Number(tokenData.expires_in) * 1000) : 0;
  let existing = getDashboardUserByDiscordId(discordUser.id);
  if (existing) {
    existing = { ...existing, username: discordUser.username, avatar: discordUser.avatar || '', access_token: tokenData.access_token || '', refresh_token: tokenData.refresh_token || '', token_expires_at: expiresAt, is_admin: isAdmin ? 1 : existing.is_admin, updated_at: now };
    cache.dashboardUsersById.set(Number(existing.id), existing);
    cache.dashboardUsersByDiscordId.set(existing.discord_user_id, existing);
    background(`UPDATE dashboard_users SET username=$1, avatar=$2, access_token=$3, refresh_token=$4, token_expires_at=$5, is_admin=$6, updated_at=$7 WHERE discord_user_id=$8`, [existing.username, existing.avatar, existing.access_token, existing.refresh_token, existing.token_expires_at, existing.is_admin, existing.updated_at, existing.discord_user_id]);
    return existing;
  }
  const tempId = Date.now();
  const row = { id: tempId, discord_user_id: discordUser.id, username: discordUser.username, email: '', avatar: discordUser.avatar || '', access_token: tokenData.access_token || '', refresh_token: tokenData.refresh_token || '', token_expires_at: expiresAt, is_admin: isAdmin ? 1 : 0, created_at: now, updated_at: now };
  cache.dashboardUsersById.set(Number(row.id), row);
  cache.dashboardUsersByDiscordId.set(row.discord_user_id, row);
  query(`
    INSERT INTO dashboard_users (discord_user_id, username, email, avatar, access_token, refresh_token, token_expires_at, is_admin, created_at, updated_at)
    VALUES ($1,$2,'',$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (discord_user_id) DO UPDATE SET
      username = EXCLUDED.username,
      avatar = EXCLUDED.avatar,
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      token_expires_at = EXCLUDED.token_expires_at,
      is_admin = EXCLUDED.is_admin,
      updated_at = EXCLUDED.updated_at
    RETURNING *
  `, [row.discord_user_id, row.username, row.avatar, row.access_token, row.refresh_token, row.token_expires_at, row.is_admin, row.created_at, row.updated_at]).then(result => {
    const saved = normalizeRowBooleans(result.rows[0]);
    cache.dashboardUsersById.delete(tempId);
    cache.dashboardUsersById.set(Number(saved.id), saved);
    cache.dashboardUsersByDiscordId.set(saved.discord_user_id, saved);
  }).catch(error => console.error('PostgreSQL dashboard user upsert failed:', error.message));
  return row;
}

function getDiscordAuthDataForUser(userId) { return getDashboardUserById(userId); }
function updateDiscordOAuthTokens(userId, tokenData) {
  const current = getDashboardUserById(userId);
  if (!current) return null;
  const now = Date.now();
  const updated = { ...current, access_token: tokenData.access_token || '', refresh_token: tokenData.refresh_token || '', token_expires_at: tokenData.expires_in ? now + Number(tokenData.expires_in) * 1000 : 0, updated_at: now };
  cache.dashboardUsersById.set(Number(updated.id), updated);
  cache.dashboardUsersByDiscordId.set(updated.discord_user_id, updated);
  background(`UPDATE dashboard_users SET access_token=$1, refresh_token=$2, token_expires_at=$3, updated_at=$4 WHERE id=$5`, [updated.access_token, updated.refresh_token, updated.token_expires_at, updated.updated_at, updated.id]);
  return updated;
}

function listDashboardUsers() { return Array.from(cache.dashboardUsersById.values()).sort((a,b) => b.created_at - a.created_at); }
function setDashboardUserAdmin(userId, isAdmin) {
  const current = getDashboardUserById(userId);
  if (!current) return null;
  const updated = { ...current, is_admin: isAdmin ? 1 : 0, updated_at: Date.now() };
  cache.dashboardUsersById.set(Number(updated.id), updated);
  cache.dashboardUsersByDiscordId.set(updated.discord_user_id, updated);
  background(`UPDATE dashboard_users SET is_admin = $1, updated_at = $2 WHERE id = $3`, [updated.is_admin, updated.updated_at, updated.id]);
  return updated;
}

function createWebSession({ dashboardUserId = null, adminCredentialsId = null, expiresAt, ipAddress = '', userAgent = '' }) {
  const id = crypto.randomBytes(32).toString('hex');
  const row = { id, dashboard_user_id: dashboardUserId, admin_credentials_id: adminCredentialsId, created_at: Date.now(), expires_at: expiresAt, ip_address: ipAddress, user_agent: userAgent.slice(0, 500) };
  cache.webSessions.set(id, row);
  background(`INSERT INTO web_sessions (id, dashboard_user_id, admin_credentials_id, created_at, expires_at, ip_address, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, dashboardUserId, adminCredentialsId, row.created_at, expiresAt, ipAddress, row.user_agent]);
  return row;
}

function getWebSession(id) {
  if (!id) return null;
  const row = cache.webSessions.get(id);
  if (!row) return null;
  if (row.expires_at <= Date.now()) { deleteWebSession(id); return null; }
  return row;
}
function deleteWebSession(id) { if (!id) return; cache.webSessions.delete(id); background(`DELETE FROM web_sessions WHERE id = $1`, [id]); }
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [id, row] of cache.webSessions.entries()) if (row.expires_at <= now) cache.webSessions.delete(id);
  background(`DELETE FROM web_sessions WHERE expires_at <= $1`, [now]);
}

function listShopItems(guildId) { return Array.from(cache.shopItems.values()).filter(i => i.guild_id === guildId).sort((a,b) => (a.price - b.price) || a.item_name.localeCompare(b.item_name)); }
function getShopItem(guildId, itemKey) { return cache.shopItems.get(shopKey(guildId, itemKey)) || null; }
function upsertShopItem(guildId, item) {
  const now = Date.now();
  const itemKey = String(item.item_key || item.itemKey || '').toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '-');
  if (!itemKey) throw new Error('item_key is required');
  const row = { guild_id: guildId, item_key: itemKey, item_name: item.item_name || item.name || itemKey, price: Number(item.price || 0), description: item.description || '', stock: Number(item.stock ?? -1), role_id: item.role_id || '', created_at: getShopItem(guildId, itemKey)?.created_at || now, updated_at: now };
  cache.shopItems.set(shopKey(guildId, itemKey), row);
  background(`
    INSERT INTO shop_items (guild_id, item_key, item_name, price, description, stock, role_id, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (guild_id, item_key) DO UPDATE SET
      item_name=EXCLUDED.item_name,
      price=EXCLUDED.price,
      description=EXCLUDED.description,
      stock=EXCLUDED.stock,
      role_id=EXCLUDED.role_id,
      updated_at=EXCLUDED.updated_at
  `, [row.guild_id, row.item_key, row.item_name, row.price, row.description, row.stock, row.role_id, row.created_at, row.updated_at]);
  return row;
}
function deleteShopItem(guildId, itemKey) { cache.shopItems.delete(shopKey(guildId, itemKey)); background(`DELETE FROM shop_items WHERE guild_id = $1 AND item_key = $2`, [guildId, itemKey]); }
function getInventory(guildId, userId) {
  return Array.from(cache.userInventory.values()).filter(i => i.guild_id === guildId && i.user_id === userId && i.quantity > 0).map(i => ({ ...i, ...(getShopItem(guildId, i.item_key) || {}) })).sort((a,b) => String(a.item_name || a.item_key).localeCompare(String(b.item_name || b.item_key)));
}
function addInventoryItem(guildId, userId, itemKey, quantity = 1) {
  const key = inventoryKey(guildId, userId, itemKey);
  const current = cache.userInventory.get(key) || { guild_id: guildId, user_id: userId, item_key: itemKey, quantity: 0 };
  const row = { ...current, quantity: current.quantity + Number(quantity || 1) };
  cache.userInventory.set(key, row);
  background(`INSERT INTO user_inventory (guild_id, user_id, item_key, quantity) VALUES ($1,$2,$3,$4) ON CONFLICT (guild_id, user_id, item_key) DO UPDATE SET quantity = EXCLUDED.quantity`, [guildId, userId, itemKey, row.quantity]);
  return row;
}
function buyShopItem(guildId, userId, itemKey, quantity = 1) {
  const item = getShopItem(guildId, itemKey);
  if (!item) return { ok: false, reason: 'item_not_found' };
  quantity = Math.max(1, Number(quantity || 1));
  if (item.stock >= 0 && item.stock < quantity) return { ok: false, reason: 'out_of_stock', item };
  const totalCost = item.price * quantity;
  const user = getUser(guildId, userId);
  if (user.balance < totalCost) return { ok: false, reason: 'insufficient_funds', item, totalCost };
  addBalance(guildId, userId, -totalCost);
  addInventoryItem(guildId, userId, item.item_key, quantity);
  if (item.stock >= 0) upsertShopItem(guildId, { ...item, stock: item.stock - quantity });
  return { ok: true, item: getShopItem(guildId, item.item_key), totalCost, inventory: getInventory(guildId, userId) };
}

function listContentWatchers(guildId, type = null) {
  return cache.contentWatchers.filter(w => w.guild_id === guildId && (!type || w.type === type)).sort((a,b) => b.created_at - a.created_at);
}
function getAllEnabledContentWatchers() { return cache.contentWatchers.filter(w => Number(w.enabled) === 1); }
function upsertContentWatcher({ guildId, type, sourceId, sourceLabel = '', discordChannelId, enabled = 1 }) {
  let existing = cache.contentWatchers.find(w => w.guild_id === guildId && w.type === type && w.source_id === sourceId);
  const now = Date.now();
  if (existing) {
    existing = { ...existing, source_label: sourceLabel, discord_channel_id: discordChannelId, enabled: enabled ? 1 : 0, updated_at: now };
    cache.contentWatchers = cache.contentWatchers.map(w => w.id === existing.id ? existing : w);
    background(`UPDATE content_watchers SET source_label=$1, discord_channel_id=$2, enabled=$3, updated_at=$4 WHERE id=$5`, [existing.source_label, existing.discord_channel_id, existing.enabled, existing.updated_at, existing.id]);
    return existing;
  }
  const row = { id: Date.now() + Math.floor(Math.random() * 1000), guild_id: guildId, type, source_id: sourceId, source_label: sourceLabel, discord_channel_id: discordChannelId, last_seen_id: '', last_seen_at: 0, enabled: enabled ? 1 : 0, created_at: now, updated_at: now };
  cache.contentWatchers.push(row);
  background(`INSERT INTO content_watchers (guild_id, type, source_id, source_label, discord_channel_id, last_seen_id, last_seen_at, enabled, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,'',0,$6,$7,$8)`, [guildId, type, sourceId, sourceLabel, discordChannelId, row.enabled, now, now]);
  return row;
}
function removeContentWatcher(guildId, type, sourceId) {
  cache.contentWatchers = cache.contentWatchers.filter(w => !(w.guild_id === guildId && w.type === type && w.source_id === sourceId));
  background(`DELETE FROM content_watchers WHERE guild_id = $1 AND type = $2 AND source_id = $3`, [guildId, type, sourceId]);
}
function updateContentWatcherState(id, patch = {}) {
  const current = cache.contentWatchers.find(w => Number(w.id) === Number(id));
  if (!current) return null;
  const updated = { ...current, ...patch, updated_at: Date.now() };
  cache.contentWatchers = cache.contentWatchers.map(w => Number(w.id) === Number(id) ? updated : w);
  background(`UPDATE content_watchers SET source_label=$1, discord_channel_id=$2, enabled=$3, last_seen_id=$4, last_seen_at=$5, updated_at=$6 WHERE id=$7`, [updated.source_label, updated.discord_channel_id, updated.enabled, updated.last_seen_id || '', updated.last_seen_at || 0, updated.updated_at, updated.id]);
  return updated;
}

function getStats() {
  return {
    guilds: cache.guildSettings.size,
    users: cache.users.size,
    tempChannels: cache.tempChannels.size,
    dashboardUsers: cache.dashboardUsersById.size,
    webSessions: cache.webSessions.size,
    watchers: cache.contentWatchers.length,
    shopItems: cache.shopItems.size
  };
}
function adminPasswordUsesDefault() { return adminPassword === adminPasswordDefaultValue; }
function getBootState() {
  const admin = cache.adminCredentialsByUsername.get(adminUsername) || { username: adminUsername, must_change_password: 1 };
  return { adminUsername: admin.username, adminMustChangePassword: !!admin.must_change_password, adminPasswordUsesDefault: adminPasswordUsesDefault(), adminDiscordIds };
}

module.exports = {
  pool,
  initDatabase,
  DEFAULT_SETTINGS,
  getGuildSettings,
  getGuildConfig: getGuildSettings,
  updateGuildSettings,
  getUser,
  addBalance,
  addBank,
  setBalance,
  transferBalance,
  addXp,
  setLastDaily,
  setLastWeekly,
  setLastWork,
  setLastCrime,
  setLastRob,
  transferToBank,
  transferFromBank,
  addWarning,
  listWarnings,
  clearWarnings,
  getLeaderboard,
  getBalanceLeaderboard,
  addTempChannel,
  getTempChannel,
  removeTempChannel,
  listShopItems,
  getShopItem,
  upsertShopItem,
  deleteShopItem,
  getInventory,
  addInventoryItem,
  buyShopItem,
  listContentWatchers,
  upsertContentWatcher,
  removeContentWatcher,
  getAllEnabledContentWatchers,
  updateContentWatcherState,
  getStats,
  ensureAdminCredentials,
  authenticateAdmin,
  changeAdminPassword,
  getAdminCredentialById,
  upsertDiscordDashboardUser,
  getDashboardUserById,
  getDashboardUserByDiscordId,
  getDiscordAuthDataForUser,
  updateDiscordOAuthTokens,
  listDashboardUsers,
  setDashboardUserAdmin,
  createWebSession,
  getWebSession,
  deleteWebSession,
  cleanupExpiredSessions,
  getBootState,
  adminPasswordUsesDefault
};
