const fs = require('fs');
require('dotenv').config();

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
  guildId: process.env.GUILD_ID,
  prefix: process.env.PREFIX || '!',
  dashboardPort: Number(process.env.DASHBOARD_PORT || 3000),
  ownerId: process.env.OWNER_ID || '',
  baseUrl: process.env.BASE_URL || `http://localhost:${Number(process.env.DASHBOARD_PORT || 3000)}`,
  discordRedirectUri: process.env.DISCORD_REDIRECT_URI || `${process.env.BASE_URL || `http://localhost:${Number(process.env.DASHBOARD_PORT || 3000)}`}/auth/discord/callback`,
  sessionSecret: process.env.SESSION_SECRET || 'change-me-in-production',
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'guildpilot_session',
  sessionCookieSecure: toBool(process.env.SESSION_COOKIE_SECURE, process.env.NODE_ENV === 'production'),
  sessionCookieSameSite: process.env.SESSION_COOKIE_SAMESITE || 'lax',
  sessionMaxAgeMs: Number(process.env.SESSION_MAX_AGE_MS || 1000 * 60 * 60 * 24 * 14),
  trustProxy: toBool(process.env.TRUST_PROXY, false),
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'ChangeMeNow_123!',
  adminPasswordDefaultValue: 'ChangeMeNow_123!',
  adminDiscordIds: String(process.env.ADMIN_DISCORD_IDS || process.env.OWNER_ID || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSslEnabled: toBool(process.env.DATABASE_SSL, true),
  databaseSslRejectUnauthorized: toBool(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED, true),
  databaseSslCa: process.env.PGSSL_CA || '',
  databaseSslCaPath: process.env.PGSSL_CA_PATH || '',
  twitchClientId: process.env.TWITCH_CLIENT_ID || '',
  twitchClientSecret: process.env.TWITCH_CLIENT_SECRET || '',
  watcherIntervalMs: Number(process.env.WATCHER_INTERVAL_MS || 120000),
  githubToken: process.env.GITHUB_TOKEN || ''
};
