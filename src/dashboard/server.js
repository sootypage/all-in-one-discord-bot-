const crypto = require('crypto');
const express = require('express');
const path = require('path');
const {
  dashboardPort,
  clientId,
  clientSecret,
  baseUrl,
  discordRedirectUri,
  sessionCookieName,
  sessionCookieSecure,
  sessionCookieSameSite,
  sessionMaxAgeMs,
  sessionSecret,
  trustProxy,
  adminDiscordIds
} = require('../config');
const {
  getStats,
  getGuildSettings,
  updateGuildSettings,
  DEFAULT_SETTINGS,
  upsertDiscordDashboardUser,
  getDashboardUserById,
  getDiscordAuthDataForUser,
  updateDiscordOAuthTokens,
  listDashboardUsers,
  setDashboardUserAdmin,
  ensureAdminCredentials,
  authenticateAdmin,
  changeAdminPassword,
  getAdminCredentialById,
  createWebSession,
  getWebSession,
  deleteWebSession,
  cleanupExpiredSessions,
  getBootState,
  listContentWatchers,
  upsertContentWatcher,
  removeContentWatcher,
  listShopItems,
  upsertShopItem,
  deleteShopItem
} = require('../utils/database');

const MANAGE_GUILD = BigInt(0x20);
const ADMINISTRATOR = BigInt(0x8);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, item) => {
    const index = item.indexOf('=');
    if (index === -1) return acc;
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function signValue(value) {
  return crypto.createHmac('sha256', sessionSecret).update(value).digest('hex');
}

function serializeCookie(sessionId) {
  const signed = `${sessionId}.${signValue(sessionId)}`;
  const parts = [
    `${sessionCookieName}=${encodeURIComponent(signed)}`,
    'HttpOnly',
    'Path=/',
    `SameSite=${sessionCookieSameSite}`,
    `Max-Age=${Math.floor(sessionMaxAgeMs / 1000)}`
  ];
  if (sessionCookieSecure) parts.push('Secure');
  return parts.join('; ');
}

function clearCookieHeader() {
  const parts = [
    `${sessionCookieName}=`,
    'HttpOnly',
    'Path=/',
    `SameSite=${sessionCookieSameSite}`,
    'Max-Age=0'
  ];
  if (sessionCookieSecure) parts.push('Secure');
  return parts.join('; ');
}

function readSignedSessionId(req) {
  const cookies = parseCookies(req);
  const raw = cookies[sessionCookieName];
  if (!raw || !raw.includes('.')) return null;
  const [sessionId, signature] = raw.split('.');
  if (!sessionId || !signature) return null;
  if (signValue(sessionId) !== signature) return null;
  return sessionId;
}

function avatarUrl(user) {
  if (!user || !user.discord_user_id || !user.avatar) return '';
  return `https://cdn.discordapp.com/avatars/${user.discord_user_id}/${user.avatar}.png?size=128`;
}

function setSession(res, session) {
  res.setHeader('Set-Cookie', serializeCookie(session.id));
}

function clearSession(req, res) {
  const sessionId = readSignedSessionId(req);
  if (sessionId) deleteWebSession(sessionId);
  res.setHeader('Set-Cookie', clearCookieHeader());
}

function requireUser(req, res, next) {
  if (!req.dashboardUser) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (req.adminUser || (req.dashboardUser && req.dashboardUser.is_admin)) return next();
  return res.status(403).send(renderSimplePage({
    title: 'Admin access required',
    user: req.dashboardUser,
    body: `<main class="page-shell narrow"><section class="panel-card"><h1>Admin access required</h1><p>You do not have access to the admin area.</p></section></main>`
  }));
}

function requireAdminPasswordChange(req, res, next) {
  if (!req.adminUser?.must_change_password) return next();
  if (req.path === '/admin/change-password' || req.path === '/admin/logout' || req.path.startsWith('/style.css')) return next();
  return res.redirect('/admin/change-password');
}

function field(label, name, value, type = 'text') {
  return `<label><span>${escapeHtml(label)}</span><input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" /></label>`;
}

function toggleField(label, name, checked) {
  return `<label class="toggle-row"><span>${escapeHtml(label)}</span><input type="checkbox" name="${escapeHtml(name)}" ${checked ? 'checked' : ''} /></label>`;
}

function navForUser(user, adminUser) {
  const common = [
    '<a href="/">Home</a>',
    '<a href="/status">Status</a>',
    '<a href="/donate">Donate</a>'
  ];

  if (user) {
    common.push('<a href="/dashboard">Dashboard</a>');
    if (user.is_admin) common.push('<a href="/admin">Admin</a>');
    common.push('<form method="post" action="/logout"><button class="ghost-btn" type="submit">Logout</button></form>');
    return common.join('');
  }

  if (adminUser) {
    common.push('<a href="/admin">Admin</a>');
    common.push('<form method="post" action="/admin/logout"><button class="ghost-btn" type="submit">Admin logout</button></form>');
    return common.join('');
  }

  common.push('<a href="/login">Login</a>');
  common.push('<a class="primary-btn" href="/auth/discord">Login with Discord</a>');
  common.push('<a href="/admin/login">Admin</a>');
  return common.join('');
}

function renderSimplePage({ title, body, user = null, adminUser = null }) {
  const currentUser = user || adminUser;
  const profile = user
    ? `<div class="user-chip"><img src="${avatarUrl(user) || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="" /><span>${escapeHtml(user.username)}</span></div>`
    : adminUser
      ? `<div class="user-chip admin-chip"><span>Admin: ${escapeHtml(adminUser.username)}</span></div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <header class="topbar">
    <div class="brand-wrap">
      <a class="brand" href="/">GuildPilot</a>
      <span class="badge">Production Dashboard</span>
    </div>
    <nav class="nav">${navForUser(user, adminUser)}</nav>
    ${profile}
  </header>
  ${body}
</body>
</html>`;
}

function renderHome(client, req) {
  const boot = getBootState();
  const stats = getStats();
  const body = `
  <main class="page-shell">
    <section class="hero-grid">
      <div class="hero-card glass">
        <p class="eyebrow">Discord bot + web panel</p>
        <h1>Manage your bot with Discord login and real per-server settings.</h1>
        <p class="hero-copy">This build includes Discord OAuth sign-in, a server dashboard filtered to servers you manage, SQLite-backed settings, a public status page, a donate page, and an admin area for production use on a VPS.</p>
        <div class="hero-actions">
          <a class="primary-btn" href="${req.dashboardUser ? '/dashboard' : '/auth/discord'}">${req.dashboardUser ? 'Open dashboard' : 'Login with Discord'}</a>
          <a class="ghost-btn" href="/status">View status</a>
        </div>
        <div class="info-grid">
          <div class="mini-card"><strong>Discord OAuth</strong><p>Users log in with Discord, not local signup.</p></div>
          <div class="mini-card"><strong>Managed servers only</strong><p>The dashboard shows servers where your account has Manage Server or Administrator.</p></div>
          <div class="mini-card"><strong>Emergency admin login</strong><p>Separate admin route for recovery and production management.</p></div>
        </div>
      </div>
      <div class="hero-side">
        <div class="stat-card glass"><span>Bot</span><strong>${escapeHtml(client.user ? client.user.tag : 'Starting...')}</strong></div>
        <div class="stat-card glass"><span>Servers</span><strong>${client.guilds.cache.size}</strong></div>
        <div class="stat-card glass"><span>Tracked users</span><strong>${stats.users}</strong></div>
        <div class="stat-card glass"><span>Web users</span><strong>${stats.dashboardUsers}</strong></div>
        <div class="stat-card glass"><span>Web sessions</span><strong>${stats.webSessions}</strong></div>
        <div class="stat-card glass"><span>Admin password status</span><strong>${boot.adminMustChangePassword ? 'Change required' : 'OK'}</strong></div>
      </div>
    </section>
  </main>`;
  return renderSimplePage({ title: 'GuildPilot Home', body, user: req.dashboardUser, adminUser: req.adminUser });
}

function renderLoginPage(req, message = '') {
  const body = `
  <main class="page-shell narrow">
    <section class="auth-card glass">
      <p class="eyebrow">Discord sign-in</p>
      <h1>Login with Discord</h1>
      <p class="muted">Use Discord to access the dashboard. Your available servers are filtered by your Discord permissions.</p>
      ${message ? `<div class="notice">${escapeHtml(message)}</div>` : ''}
      <a class="primary-btn wide" href="/auth/discord">Continue with Discord</a>
      <p class="muted small">Need emergency admin access? <a href="/admin/login">Use admin login</a>.</p>
    </section>
  </main>`;
  return renderSimplePage({ title: 'Login', body, user: req.dashboardUser, adminUser: req.adminUser });
}

function renderAdminLogin(message = '') {
  const body = `
  <main class="page-shell narrow">
    <section class="auth-card glass">
      <p class="eyebrow">Emergency admin access</p>
      <h1>Admin login</h1>
      <p class="muted">Use this only for panel administration and recovery. Discord OAuth remains the normal login for dashboard users.</p>
      ${message ? `<div class="notice">${escapeHtml(message)}</div>` : ''}
      <form method="post" action="/admin/login" class="auth-form">
        ${field('Username', 'username', '')}
        ${field('Password', 'password', '', 'password')}
        <button class="primary-btn wide" type="submit">Login</button>
      </form>
    </section>
  </main>`;
  return renderSimplePage({ title: 'Admin login', body });
}

function renderAdminPasswordChange(adminUser, message = '') {
  const body = `
  <main class="page-shell narrow">
    <section class="auth-card glass">
      <p class="eyebrow">Password update required</p>
      <h1>Change admin password</h1>
      <p class="muted">This admin account is still using the default or initial password. Set a new one before using the admin area.</p>
      ${message ? `<div class="notice">${escapeHtml(message)}</div>` : ''}
      <form method="post" action="/admin/change-password" class="auth-form">
        ${field('New password', 'password', '', 'password')}
        ${field('Confirm password', 'confirmPassword', '', 'password')}
        <button class="primary-btn wide" type="submit">Save new password</button>
      </form>
    </section>
  </main>`;
  return renderSimplePage({ title: 'Change admin password', body, adminUser });
}

function hasGuildAccess(userGuild, botGuildIds) {
  try {
    const perms = BigInt(userGuild.permissions || '0');
    return botGuildIds.has(userGuild.id) && ((perms & ADMINISTRATOR) === ADMINISTRATOR || (perms & MANAGE_GUILD) === MANAGE_GUILD);
  } catch {
    return false;
  }
}

function getManagedGuildsForRequest(client, req) {
  const botGuildIds = new Set(client.guilds.cache.map(guild => guild.id));
  const oauthGuilds = Array.isArray(req.discordGuilds) ? req.discordGuilds : [];
  return oauthGuilds
    .filter(guild => hasGuildAccess(guild, botGuildIds))
    .map(guild => {
      const liveGuild = client.guilds.cache.get(guild.id);
      if (!liveGuild) return null;
      return {
        id: liveGuild.id,
        name: liveGuild.name,
        iconURL: liveGuild.iconURL({ size: 128 }) || '',
        memberCount: liveGuild.memberCount,
        channels: liveGuild.channels.cache.size,
        roles: liveGuild.roles.cache.size,
        settings: getGuildSettings(liveGuild.id)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}


function optionList(values, current) {
  return values.map(value => `<option value="${escapeHtml(value)}" ${current === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
}

function renderWatcherRows(watchers) {
  if (!watchers.length) return '<p class="muted">No alerts configured yet.</p>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Type</th><th>Source</th><th>Channel</th><th>Status</th><th></th></tr></thead><tbody>${watchers.map(w => `<tr><td>${escapeHtml(w.type)}</td><td><strong>${escapeHtml(w.source_label || w.source_id)}</strong><br /><span class="muted tiny">${escapeHtml(w.source_id)}</span></td><td>${escapeHtml(w.discord_channel_id)}</td><td>${w.enabled ? '<span class="pill ok">Enabled</span>' : '<span class="pill off">Disabled</span>'}</td><td><form method="post" action="/dashboard/guild/${w.guild_id}/watchers/delete"><input type="hidden" name="type" value="${escapeHtml(w.type)}" /><input type="hidden" name="source_id" value="${escapeHtml(w.source_id)}" /><button class="ghost-btn danger-btn" type="submit">Remove</button></form></td></tr>`).join('')}</tbody></table></div>`;
}

function renderShopRows(guildId, items) {
  if (!items.length) return '<p class="muted">No shop items yet.</p>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Key</th><th>Name</th><th>Price</th><th>Stock</th><th>Role</th><th></th></tr></thead><tbody>${items.map(item => `<tr><td>${escapeHtml(item.item_key)}</td><td><strong>${escapeHtml(item.item_name)}</strong><br /><span class="muted tiny">${escapeHtml(item.description || '')}</span></td><td>${item.price}</td><td>${item.stock}</td><td>${escapeHtml(item.role_id || '-')}</td><td><form method="post" action="/dashboard/guild/${guildId}/shop/delete"><input type="hidden" name="item_key" value="${escapeHtml(item.item_key)}" /><button class="ghost-btn danger-btn" type="submit">Delete</button></form></td></tr>`).join('')}</tbody></table></div>`;
}

function renderDashboard(client, req) {
  const guilds = getManagedGuildsForRequest(client, req);
  const cards = guilds.map(guild => `
    <a class="server-card" href="/dashboard/guild/${guild.id}">
      <div class="server-card-top">
        ${guild.iconURL ? `<img class="server-icon" src="${guild.iconURL}" alt="" />` : `<div class="server-icon fallback">${escapeHtml(guild.name[0]?.toUpperCase() || '?')}</div>`}
        <div>
          <h3>${escapeHtml(guild.name)}</h3>
          <p>${guild.memberCount} members • ${guild.channels} channels • ${guild.roles} roles</p>
        </div>
      </div>
      <div class="server-flags">
        <span class="pill ${guild.settings.economy_enabled ? 'ok' : 'off'}">Economy ${guild.settings.economy_enabled ? 'on' : 'off'}</span>
        <span class="pill ${guild.settings.leveling_enabled ? 'ok' : 'off'}">Leveling ${guild.settings.leveling_enabled ? 'on' : 'off'}</span>
        <span class="pill">Prefix ${escapeHtml(guild.settings.prefix)}</span>
      </div>
    </a>`).join('');

  const body = `
  <main class="page-shell">
    <section class="section-head">
      <div>
        <p class="eyebrow">Your managed servers</p>
        <h1>Dashboard</h1>
        <p class="muted">Only servers where your Discord account has Manage Server or Administrator are shown here, and only if the bot is in them too.</p>
      </div>
      <div class="head-actions">
        <a class="ghost-btn" href="/status">Status</a>
        ${req.dashboardUser.is_admin ? '<a class="ghost-btn" href="/admin">Admin panel</a>' : ''}
      </div>
    </section>
    ${guilds.length ? `<section class="server-grid">${cards}</section>` : `<section class="panel-card"><h2>No managed servers found</h2><p>You are logged in, but no shared servers matched both conditions: the bot is inside them and your Discord account has Manage Server or Administrator.</p></section>`}
  </main>`;
  return renderSimplePage({ title: 'Dashboard', body, user: req.dashboardUser });
}

function renderGuildPage(client, req, guildId, message = '', isError = false) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    return renderSimplePage({
      title: 'Guild not found',
      user: req.dashboardUser,
      body: `<main class="page-shell narrow"><section class="panel-card"><h1>Guild not found</h1><p>The bot is not in that server.</p></section></main>`
    });
  }

  const allowedIds = new Set(getManagedGuildsForRequest(client, req).map(item => item.id));
  if (!allowedIds.has(guildId) && !req.dashboardUser.is_admin) {
    return renderSimplePage({
      title: 'Access denied',
      user: req.dashboardUser,
      body: `<main class="page-shell narrow"><section class="panel-card"><h1>Access denied</h1><p>Your Discord account does not manage this server.</p></section></main>`
    });
  }

  const settings = getGuildSettings(guildId);
  const watchers = listContentWatchers(guildId);
  const shopItems = listShopItems(guildId);
  const body = `
  <main class="page-shell">
    <section class="section-head">
      <div>
        <p class="eyebrow">Per-server configuration</p>
        <h1>${escapeHtml(guild.name)}</h1>
        <p class="muted">These settings are stored in SQLite and used by the bot. This page covers the full saved guild config in this project.</p>
      </div>
      <a class="ghost-btn" href="/dashboard">Back</a>
    </section>
    ${message ? `<div class="notice ${isError ? '' : 'success'}">${escapeHtml(message)}</div>` : ''}
    <form class="config-layout" method="post" action="/dashboard/guild/${guild.id}">
      <section class="panel-card stack">
        <h2>General</h2>
        ${field('Prefix', 'prefix', settings.prefix)}
        ${field('Mod log channel ID', 'mod_log_channel_id', settings.mod_log_channel_id)}
        ${field('Full log channel ID', 'log_channel_id', settings.log_channel_id)}
        ${field('Level up channel ID', 'level_up_channel_id', settings.level_up_channel_id)}
        ${toggleField('Member join/leave logs', 'member_log_enabled', !!settings.member_log_enabled)}
        ${toggleField('Message delete logs', 'message_log_enabled', !!settings.message_log_enabled)}
        ${toggleField('Command logs', 'command_log_enabled', !!settings.command_log_enabled)}
      </section>

      <section class="panel-card stack">
        <h2>Tickets</h2>
        ${field('Ticket panel channel ID', 'tickets_channel_id', settings.tickets_channel_id)}
        ${field('Ticket category ID', 'tickets_category_id', settings.tickets_category_id)}
        ${field('Ticket support role ID', 'ticket_support_role_id', settings.ticket_support_role_id)}
        <label><span>Ticket categories JSON</span><textarea name="ticket_categories_json" rows="8">${escapeHtml(settings.ticket_categories_json)}</textarea><small>Example: [{"label":"Support","value":"support","emoji":"🎫"}]</small></label>
      </section>

      <section class="panel-card stack">
        <h2>Temp voice channels</h2>
        ${field('Create channel ID', 'temp_vc_create_channel_id', settings.temp_vc_create_channel_id)}
        ${field('Voice category ID', 'temp_vc_category_id', settings.temp_vc_category_id)}
      </section>

      <section class="panel-card stack">
        <h2>Welcome / leave</h2>
        ${toggleField('Welcome enabled', 'welcome_enabled', !!settings.welcome_enabled)}
        ${field('Welcome channel ID', 'welcome_channel_id', settings.welcome_channel_id)}
        <label><span>Welcome message</span><textarea name="welcome_message" rows="3">${escapeHtml(settings.welcome_message)}</textarea><small>Placeholders: {user}, {username}, {tag}, {server}, {memberCount}</small></label>
        ${toggleField('Leave enabled', 'leave_enabled', !!settings.leave_enabled)}
        ${field('Leave channel ID', 'leave_channel_id', settings.leave_channel_id)}
        <label><span>Leave message</span><textarea name="leave_message" rows="3">${escapeHtml(settings.leave_message)}</textarea></label>
      </section>

      <section class="panel-card stack">
        <h2>Verification / auto role</h2>
        ${toggleField('Auto role enabled', 'auto_role_enabled', !!settings.auto_role_enabled)}
        ${field('Auto role ID', 'auto_role_id', settings.auto_role_id)}
        ${toggleField('Verification enabled', 'verification_enabled', !!settings.verification_enabled)}
        ${field('Verification channel ID', 'verification_channel_id', settings.verification_channel_id)}
        ${field('Verified role ID', 'verification_role_id', settings.verification_role_id)}
        <label><span>Verification panel message</span><textarea name="verification_message" rows="3">${escapeHtml(settings.verification_message)}</textarea></label>
        <p class="muted">Use <code>/verificationpanel</code> to send the verify button after saving these settings.</p>
      </section>

      <section class="panel-card stack">
        <h2>Economy</h2>
        ${toggleField('Economy enabled', 'economy_enabled', !!settings.economy_enabled)}
        ${field('Daily amount', 'daily_amount', settings.daily_amount, 'number')}
        ${field('Work minimum', 'work_min', settings.work_min, 'number')}
        ${field('Work maximum', 'work_max', settings.work_max, 'number')}
        ${field('Starter balance', 'starter_balance', settings.starter_balance, 'number')}
        <p class="muted">Manage reward values here, then add store items below for the dashboard-driven economy shop.</p>
      </section>

      <section class="panel-card stack">
        <h2>Leveling</h2>
        ${toggleField('Leveling enabled', 'leveling_enabled', !!settings.leveling_enabled)}
        ${field('XP minimum', 'xp_min', settings.xp_min, 'number')}
        ${field('XP maximum', 'xp_max', settings.xp_max, 'number')}
        ${field('XP cooldown seconds', 'xp_cooldown_seconds', settings.xp_cooldown_seconds, 'number')}
      </section>

      <section class="panel-card stack">
        <h2>Moderation</h2>
        <p class="muted">The mod system in this build uses slash commands. Set the mod log channel above, then use commands like <code>/warn</code>, <code>/warnings</code>, <code>/timeout</code>, <code>/ban</code>, <code>/slowmode</code>, and <code>/role</code>.</p>
        <div class="chip-row"><span class="pill">/warn</span><span class="pill">/warnings</span><span class="pill">/timeout</span><span class="pill">/clear</span><span class="pill">/slowmode</span><span class="pill">/role</span></div>
      </section>

      <section class="panel-card stack wide-card">
        <h2>Save changes</h2>
        <p class="muted">This page edits every guild setting currently stored by the bot. Below it you can also manage alerts and shop items without using slash commands.</p>
        <button class="primary-btn" type="submit">Save config</button>
      </section>
    </form>

    <section class="section-head compact-head">
      <div>
        <p class="eyebrow">Integrations</p>
        <h2>Alerts and content feeds</h2>
        <p class="muted">Add YouTube, Twitch, and GitHub alerts for this server. The bot will poll and post updates into the channel you choose.</p>
      </div>
    </section>

    <section class="cards-grid two-up">
      <section class="panel-card stack">
        <h3>Add alert</h3>
        <form class="stack" method="post" action="/dashboard/guild/${guild.id}/watchers/add">
          <label><span>Type</span><select name="type">${optionList(['youtube','twitch','github'], 'youtube')}</select></label>
          ${field('Source ID or repo path', 'source_id', '')}
          ${field('Display label', 'source_label', '')}
          ${field('Discord channel ID', 'discord_channel_id', settings.mod_log_channel_id || settings.tickets_channel_id || '')}
          <small>Examples: YouTube channel ID, Twitch username, or GitHub repo like owner/repo.</small>
          <button class="primary-btn" type="submit">Add alert</button>
        </form>
      </section>
      <section class="panel-card stack">
        <h3>Configured alerts</h3>
        ${renderWatcherRows(watchers)}
      </section>
    </section>

    <section class="section-head compact-head">
      <div>
        <p class="eyebrow">Economy tools</p>
        <h2>Shop manager</h2>
        <p class="muted">Create items for <code>/shop</code> and <code>/buy</code> here. Role ID is optional and can be used for role rewards.</p>
      </div>
    </section>

    <section class="cards-grid two-up">
      <section class="panel-card stack">
        <h3>Add shop item</h3>
        <form class="stack" method="post" action="/dashboard/guild/${guild.id}/shop/add">
          ${field('Item key', 'item_key', '')}
          ${field('Item name', 'item_name', '')}
          ${field('Price', 'price', '100', 'number')}
          ${field('Stock (-1 for unlimited)', 'stock', '-1', 'number')}
          ${field('Role ID (optional)', 'role_id', '')}
          <label><span>Description</span><textarea name="description" rows="4"></textarea></label>
          <button class="primary-btn" type="submit">Add item</button>
        </form>
      </section>
      <section class="panel-card stack">
        <h3>Current shop items</h3>
        ${renderShopRows(guild.id, shopItems)}
      </section>
    </section>
  </main>`;
  return renderSimplePage({ title: `${guild.name} Config`, body, user: req.dashboardUser });
}

function renderStatus(client, req) {
  const stats = getStats();
  const uptimeMs = client.uptime || 0;
  const uptimeMinutes = Math.floor(uptimeMs / 60000);
  const uptimeHours = Math.floor(uptimeMinutes / 60);
  const uptimeRemainderMinutes = uptimeMinutes % 60;
  const body = `
  <main class="page-shell">
    <section class="section-head">
      <div>
        <p class="eyebrow">Live health</p>
        <h1>Status page</h1>
      </div>
      <a class="ghost-btn" href="/api/stats">Raw JSON</a>
    </section>
    <section class="cards-grid">
      <div class="panel-card"><span>Bot</span><strong>${escapeHtml(client.user ? client.user.tag : 'Starting...')}</strong></div>
      <div class="panel-card"><span>Gateway ping</span><strong>${client.ws.ping}ms</strong></div>
      <div class="panel-card"><span>Servers</span><strong>${client.guilds.cache.size}</strong></div>
      <div class="panel-card"><span>Tracked users</span><strong>${stats.users}</strong></div>
      <div class="panel-card"><span>Temp voice channels</span><strong>${stats.tempChannels}</strong></div>
      <div class="panel-card"><span>Uptime</span><strong>${uptimeHours}h ${uptimeRemainderMinutes}m</strong></div>
    </section>
  </main>`;
  return renderSimplePage({ title: 'Status', body, user: req.dashboardUser, adminUser: req.adminUser });
}

function renderDonate(req) {
  const body = `
  <main class="page-shell narrowish">
    <section class="glass panel-stack donate-hero">
      <p class="eyebrow">Support the project</p>
      <h1>Donate</h1>
      <p class="hero-copy">Swap these placeholders for your real PayPal, Stripe, or checkout links. This page is public so users can support the bot and panel.</p>
      <div class="donate-grid">
        <div class="panel-card price-card"><span>Supporter</span><strong>$5</strong><p>Helps with monthly hosting.</p><a class="primary-btn wide" href="#">Donate</a></div>
        <div class="panel-card price-card featured"><span>Premium</span><strong>$15</strong><p>Good default tier for regular supporters.</p><a class="primary-btn wide" href="#">Donate</a></div>
        <div class="panel-card price-card"><span>Legend</span><strong>$30</strong><p>For bigger support and future upgrades.</p><a class="primary-btn wide" href="#">Donate</a></div>
      </div>
    </section>
  </main>`;
  return renderSimplePage({ title: 'Donate', body, user: req.dashboardUser, adminUser: req.adminUser });
}

function renderAdminPage(client, req, message = '') {
  const boot = getBootState();
  const users = listDashboardUsers();
  const userRows = users.map(user => `
    <tr>
      <td>${escapeHtml(user.username)}</td>
      <td>${escapeHtml(user.discord_user_id || '')}</td>
      <td>${user.is_admin ? 'Yes' : 'No'}</td>
      <td>
        <form method="post" action="/admin/users/${user.id}/toggle-admin">
          <button class="ghost-btn" type="submit">${user.is_admin ? 'Remove admin' : 'Make admin'}</button>
        </form>
      </td>
    </tr>`).join('');

  const body = `
  <main class="page-shell">
    <section class="section-head">
      <div>
        <p class="eyebrow">Production controls</p>
        <h1>Admin panel</h1>
        <p class="muted">Manage dashboard admins, review the boot state, and check production-critical settings.</p>
      </div>
    </section>
    ${message ? `<div class="notice success">${escapeHtml(message)}</div>` : ''}
    <section class="cards-grid">
      <div class="panel-card"><span>Bot guilds</span><strong>${client.guilds.cache.size}</strong></div>
      <div class="panel-card"><span>Dashboard users</span><strong>${users.length}</strong></div>
      <div class="panel-card"><span>Emergency admin</span><strong>${escapeHtml(boot.adminUsername)}</strong></div>
      <div class="panel-card"><span>Password change required</span><strong>${boot.adminMustChangePassword ? 'Yes' : 'No'}</strong></div>
    </section>

    <section class="panel-card table-card">
      <h2>Discord dashboard users</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Discord ID</th><th>Admin</th><th>Action</th></tr></thead>
          <tbody>${userRows || '<tr><td colspan="4">No Discord users have logged in yet.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  </main>`;

  return renderSimplePage({ title: 'Admin panel', body, user: req.dashboardUser, adminUser: req.adminUser });
}

function getRequestOrigin(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function buildDiscordAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: discordRedirectUri,
    scope: 'identify guilds',
    state
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: discordRedirectUri
    })
  });
  if (!response.ok) throw new Error(`Token exchange failed with ${response.status}`);
  return response.json();
}

async function refreshDiscordToken(refreshToken) {
  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  if (!response.ok) throw new Error(`Token refresh failed with ${response.status}`);
  return response.json();
}

async function fetchDiscordIdentity(accessToken) {
  const [userResponse, guildsResponse] = await Promise.all([
    fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${accessToken}` } }),
    fetch('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${accessToken}` } })
  ]);
  if (!userResponse.ok || !guildsResponse.ok) throw new Error('Discord identity fetch failed');
  return {
    user: await userResponse.json(),
    guilds: await guildsResponse.json()
  };
}

function toInt(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function startDashboard(client) {
  ensureAdminCredentials();
  cleanupExpiredSessions();

  const app = express();
  if (trustProxy) app.set('trust proxy', 1);

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.use((req, res, next) => {
    cleanupExpiredSessions();
    req.dashboardUser = null;
    req.adminUser = null;
    req.discordGuilds = [];

    const sessionId = readSignedSessionId(req);
    const session = getWebSession(sessionId);
    if (session) {
      if (session.dashboard_user_id) req.dashboardUser = getDashboardUserById(session.dashboard_user_id);
      if (session.admin_credentials_id) req.adminUser = getAdminCredentialById(session.admin_credentials_id);
    }

    next();
  });

  app.use((req, res, next) => {
    if (req.adminUser) return requireAdminPasswordChange(req, res, next);
    next();
  });

  app.get('/api/stats', (req, res) => {
    const local = getStats();
    res.json({
      botTag: client.user ? client.user.tag : 'Starting...',
      guilds: client.guilds.cache.size,
      users: client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0),
      ping: client.ws.ping,
      trackedUsers: local.users,
      tempChannels: local.tempChannels,
      dashboardUsers: local.dashboardUsers,
      webSessions: local.webSessions,
      baseUrl,
      requestOrigin: getRequestOrigin(req)
    });
  });

  app.get('/', (req, res) => res.send(renderHome(client, req)));
  app.get('/login', (req, res) => res.send(renderLoginPage(req)));
  app.get('/status', (req, res) => res.send(renderStatus(client, req)));
  app.get('/donate', (req, res) => res.send(renderDonate(req)));

  app.get('/auth/discord', (req, res) => {
    if (!clientId || !clientSecret) {
      return res.status(500).send(renderLoginPage(req, 'Discord OAuth is not configured yet. Add CLIENT_ID and DISCORD_CLIENT_SECRET to your .env.'));
    }
    const state = crypto.randomBytes(24).toString('hex');
    res.cookieState = state;
    res.setHeader('Set-Cookie', `discord_oauth_state=${state}; HttpOnly; Path=/; SameSite=Lax; Max-Age=600${sessionCookieSecure ? '; Secure' : ''}`);
    res.redirect(buildDiscordAuthUrl(state));
  });

  app.get('/auth/discord/callback', async (req, res) => {
    const cookies = parseCookies(req);
    if (!req.query.code || !req.query.state || cookies.discord_oauth_state !== req.query.state) {
      return res.status(400).send(renderLoginPage(req, 'Discord login failed because the OAuth state did not match. Try logging in again.'));
    }

    try {
      const tokenData = await exchangeCodeForToken(String(req.query.code));
      const identity = await fetchDiscordIdentity(tokenData.access_token);
      const isAdmin = adminDiscordIds.includes(identity.user.id);
      const dashboardUser = upsertDiscordDashboardUser({ discordUser: identity.user, tokenData, isAdmin });
      const session = createWebSession({
        dashboardUserId: dashboardUser.id,
        expiresAt: Date.now() + sessionMaxAgeMs,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || ''
      });
      setSession(res, session);
      res.setHeader('Set-Cookie', [serializeCookie(session.id), `discord_oauth_state=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${sessionCookieSecure ? '; Secure' : ''}`]);
      req.discordGuilds = identity.guilds;
      return res.redirect('/dashboard?refresh=1');
    } catch (error) {
      console.error('Discord OAuth callback failed:', error);
      return res.status(500).send(renderLoginPage(req, 'Discord login failed during token exchange or identity fetch. Check your redirect URI and client secret.'));
    }
  });

  async function hydrateDiscordGuilds(req) {
    if (!req.dashboardUser) return;
    let auth = getDiscordAuthDataForUser(req.dashboardUser.id);
    if (!auth?.access_token) return;
    try {
      const identity = await fetchDiscordIdentity(auth.access_token);
      req.discordGuilds = identity.guilds;
      return;
    } catch (error) {
      const canRefresh = auth.refresh_token && auth.token_expires_at && auth.token_expires_at <= Date.now();
      if (!canRefresh) throw error;
    }

    const refreshed = await refreshDiscordToken(auth.refresh_token);
    auth = updateDiscordOAuthTokens(req.dashboardUser.id, refreshed);
    const identity = await fetchDiscordIdentity(auth.access_token);
    req.discordGuilds = identity.guilds;
  }

  app.get('/dashboard', requireUser, async (req, res) => {
    try {
      await hydrateDiscordGuilds(req);
    } catch (error) {
      console.error('Dashboard refresh error:', error);
    }
    res.send(renderDashboard(client, req));
  });

  app.get('/dashboard/guild/:guildId', requireUser, async (req, res) => {
    try {
      await hydrateDiscordGuilds(req);
    } catch (error) {
      console.error('Guild page auth refresh error:', error);
    }
    res.send(renderGuildPage(client, req, req.params.guildId));
  });

  app.post('/dashboard/guild/:guildId', requireUser, async (req, res) => {
    try {
      await hydrateDiscordGuilds(req);
    } catch (error) {
      console.error('Guild save auth refresh error:', error);
    }

    const guildId = req.params.guildId;
    const current = getGuildSettings(guildId);
    let ticketCategoriesJson = String(req.body.ticket_categories_json || '[]').trim();
    try {
      const parsed = JSON.parse(ticketCategoriesJson || '[]');
      ticketCategoriesJson = JSON.stringify(parsed);
    } catch (error) {
      return res.status(400).send(renderGuildPage(client, req, guildId, 'Ticket categories JSON is invalid.', true));
    }

    updateGuildSettings(guildId, {
      prefix: String(req.body.prefix || DEFAULT_SETTINGS.prefix).slice(0, 5),
      mod_log_channel_id: String(req.body.mod_log_channel_id || '').trim(),
      log_channel_id: String(req.body.log_channel_id || '').trim(),
      tickets_channel_id: String(req.body.tickets_channel_id || '').trim(),
      tickets_category_id: String(req.body.tickets_category_id || '').trim(),
      ticket_support_role_id: String(req.body.ticket_support_role_id || '').trim(),
      ticket_categories_json: ticketCategoriesJson,
      temp_vc_create_channel_id: String(req.body.temp_vc_create_channel_id || '').trim(),
      temp_vc_category_id: String(req.body.temp_vc_category_id || '').trim(),
      level_up_channel_id: String(req.body.level_up_channel_id || '').trim(),
      welcome_enabled: req.body.welcome_enabled ? 1 : 0,
      welcome_channel_id: String(req.body.welcome_channel_id || '').trim(),
      welcome_message: String(req.body.welcome_message || DEFAULT_SETTINGS.welcome_message).slice(0, 1900),
      leave_enabled: req.body.leave_enabled ? 1 : 0,
      leave_channel_id: String(req.body.leave_channel_id || '').trim(),
      leave_message: String(req.body.leave_message || DEFAULT_SETTINGS.leave_message).slice(0, 1900),
      auto_role_enabled: req.body.auto_role_enabled ? 1 : 0,
      auto_role_id: String(req.body.auto_role_id || '').trim(),
      verification_enabled: req.body.verification_enabled ? 1 : 0,
      verification_channel_id: String(req.body.verification_channel_id || '').trim(),
      verification_role_id: String(req.body.verification_role_id || '').trim(),
      verification_message: String(req.body.verification_message || DEFAULT_SETTINGS.verification_message).slice(0, 1900),
      member_log_enabled: req.body.member_log_enabled ? 1 : 0,
      message_log_enabled: req.body.message_log_enabled ? 1 : 0,
      command_log_enabled: req.body.command_log_enabled ? 1 : 0,
      leveling_enabled: req.body.leveling_enabled ? 1 : 0,
      economy_enabled: req.body.economy_enabled ? 1 : 0,
      daily_amount: toInt(req.body.daily_amount, current.daily_amount),
      work_min: toInt(req.body.work_min, current.work_min),
      work_max: toInt(req.body.work_max, current.work_max),
      starter_balance: toInt(req.body.starter_balance, current.starter_balance),
      xp_min: toInt(req.body.xp_min, current.xp_min),
      xp_max: toInt(req.body.xp_max, current.xp_max),
      xp_cooldown_seconds: toInt(req.body.xp_cooldown_seconds, current.xp_cooldown_seconds)
    });

    res.send(renderGuildPage(client, req, guildId, 'Guild settings saved successfully.'));
  });

  app.post('/dashboard/guild/:guildId/watchers/add', requireUser, async (req, res) => {
    try { await hydrateDiscordGuilds(req); } catch (error) { console.error('Watcher save auth refresh error:', error); }
    const guildId = req.params.guildId;
    const type = String(req.body.type || '').trim().toLowerCase();
    const sourceId = String(req.body.source_id || '').trim();
    const sourceLabel = String(req.body.source_label || '').trim();
    const discordChannelId = String(req.body.discord_channel_id || '').trim();
    if (!['youtube', 'twitch', 'github'].includes(type) || !sourceId || !discordChannelId) {
      return res.status(400).send(renderGuildPage(client, req, guildId, 'Alert type, source, and channel are required.', true));
    }
    upsertContentWatcher({ guildId, type, sourceId, sourceLabel, discordChannelId, enabled: 1 });
    res.send(renderGuildPage(client, req, guildId, 'Alert saved successfully.'));
  });

  app.post('/dashboard/guild/:guildId/watchers/delete', requireUser, async (req, res) => {
    try { await hydrateDiscordGuilds(req); } catch (error) { console.error('Watcher delete auth refresh error:', error); }
    const guildId = req.params.guildId;
    removeContentWatcher(guildId, String(req.body.type || '').trim(), String(req.body.source_id || '').trim());
    res.send(renderGuildPage(client, req, guildId, 'Alert removed successfully.'));
  });

  app.post('/dashboard/guild/:guildId/shop/add', requireUser, async (req, res) => {
    try { await hydrateDiscordGuilds(req); } catch (error) { console.error('Shop save auth refresh error:', error); }
    const guildId = req.params.guildId;
    const itemKey = String(req.body.item_key || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 50);
    const itemName = String(req.body.item_name || '').trim().slice(0, 80);
    if (!itemKey || !itemName) {
      return res.status(400).send(renderGuildPage(client, req, guildId, 'Item key and item name are required.', true));
    }
    upsertShopItem(guildId, {
      item_key: itemKey,
      item_name: itemName,
      price: toInt(req.body.price, 0),
      description: String(req.body.description || '').trim().slice(0, 300),
      stock: toInt(req.body.stock, -1),
      role_id: String(req.body.role_id || '').trim()
    });
    res.send(renderGuildPage(client, req, guildId, 'Shop item saved successfully.'));
  });

  app.post('/dashboard/guild/:guildId/shop/delete', requireUser, async (req, res) => {
    try { await hydrateDiscordGuilds(req); } catch (error) { console.error('Shop delete auth refresh error:', error); }
    const guildId = req.params.guildId;
    deleteShopItem(guildId, String(req.body.item_key || '').trim());
    res.send(renderGuildPage(client, req, guildId, 'Shop item deleted successfully.'));
  });

  app.post('/logout', (req, res) => {
    clearSession(req, res);
    res.redirect('/');
  });

  app.get('/admin/login', (req, res) => res.send(renderAdminLogin()));
  app.post('/admin/login', (req, res) => {
    const admin = authenticateAdmin(String(req.body.username || ''), String(req.body.password || ''));
    if (!admin) return res.status(401).send(renderAdminLogin('Admin login failed.'));
    const session = createWebSession({
      adminCredentialsId: admin.id,
      expiresAt: Date.now() + sessionMaxAgeMs,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || ''
    });
    setSession(res, session);
    if (admin.must_change_password) return res.redirect('/admin/change-password');
    return res.redirect('/admin');
  });

  app.get('/admin/change-password', (req, res) => {
    if (!req.adminUser) return res.redirect('/admin/login');
    res.send(renderAdminPasswordChange(req.adminUser));
  });

  app.post('/admin/change-password', (req, res) => {
    if (!req.adminUser) return res.redirect('/admin/login');
    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || '');
    if (password.length < 10) {
      return res.status(400).send(renderAdminPasswordChange(req.adminUser, 'Use at least 10 characters for the new admin password.'));
    }
    if (password !== confirmPassword) {
      return res.status(400).send(renderAdminPasswordChange(req.adminUser, 'The passwords did not match.'));
    }
    changeAdminPassword(req.adminUser.id, password);
    return res.redirect('/admin');
  });

  app.post('/admin/logout', (req, res) => {
    clearSession(req, res);
    res.redirect('/');
  });

  app.get('/admin', requireAdmin, (req, res) => {
    res.send(renderAdminPage(client, req));
  });

  app.post('/admin/users/:userId/toggle-admin', requireAdmin, (req, res) => {
    const user = getDashboardUserById(Number(req.params.userId));
    if (!user) return res.redirect('/admin');
    setDashboardUserAdmin(user.id, !user.is_admin);
    res.send(renderAdminPage(client, req, `Updated admin status for ${user.username}.`));
  });

  app.use((req, res) => {
    res.status(404).send(renderSimplePage({
      title: 'Not found',
      user: req.dashboardUser,
      adminUser: req.adminUser,
      body: `<main class="page-shell narrow"><section class="panel-card"><h1>Page not found</h1><p>The page you requested does not exist.</p></section></main>`
    }));
  });

  app.listen(dashboardPort, () => {
    console.log(`Dashboard running on ${baseUrl}`);
  });
}

module.exports = { startDashboard };
