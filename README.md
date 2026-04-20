# Discord bot starter

This version has been switched to PostgreSQL storage with optional SSL CA certificate support.

# GuildPilot Bot + Production Dashboard Starter v5

This build includes:
- moderation commands
- fun commands
- economy and leveling
- tickets with dropdown categories
- temp voice channels
- Discord OAuth dashboard login
- emergency local admin login
- YouTube upload alerts
- Twitch live alerts
- GitHub repository update alerts
- per-server config stored in SQLite
- dashboard pages for alerts and economy shop management

## New in v5

Added commands and systems for:
- YouTube alerts with RSS polling
- Twitch alerts with the Twitch API
- GitHub repo alerts using the GitHub events API
- warning storage and warning history
- untimeout, slowmode, and role commands
- weekly rewards, deposit, withdraw, crime, rob, inventory, buy, and addshopitem

## Important notes

This is a stronger production starter, not a guarantee of a fully hardened public SaaS app. Before public launch, you should still add:
- rate limiting
- CSRF protection
- audit logging
- backups for SQLite or move to Postgres/MySQL
- webhook signing if you later switch GitHub to webhook delivery

## Install

```bash
npm install
cp .env.example .env
```

Then edit `.env`.

## Required env values

```env
DISCORD_TOKEN=
CLIENT_ID=
DISCORD_CLIENT_SECRET=
GUILD_ID=
BASE_URL=https://panel.yourdomain.com
DISCORD_REDIRECT_URI=https://panel.yourdomain.com/auth/discord/callback
SESSION_SECRET=replace_me
ADMIN_PASSWORD=replace_me
NODE_ENV=production
```

## Optional alert env values

Twitch alerts need these:

```env
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
```

GitHub alerts can work without a token for light use, but a token is better:

```env
GITHUB_TOKEN=
```

Polling interval:

```env
WATCHER_INTERVAL_MS=120000
```

## Alert commands

- `/youtubealerts add`
- `/youtubealerts remove`
- `/youtubealerts list`
- `/twitchalerts add`
- `/twitchalerts remove`
- `/twitchalerts list`
- `/githubalerts add`
- `/githubalerts remove`
- `/githubalerts list`

## Moderation commands

- `/ban`
- `/kick`
- `/timeout`
- `/untimeout`
- `/warn`
- `/warnings view`
- `/warnings clear`
- `/clear`
- `/lock`
- `/unlock`
- `/slowmode`
- `/nickname`
- `/role add`
- `/role remove`

## Economy commands

- `/balance`
- `/daily`
- `/weekly`
- `/work`
- `/crime`
- `/rob`
- `/pay`
- `/deposit`
- `/withdraw`
- `/shop`
- `/buy`
- `/inventory`
- `/richest`
- `/addshopitem`
- `/givecoins`
- `/economyconfig`

## VPS notes

Use HTTPS in production. If you run behind Nginx or another reverse proxy, keep:

```env
NODE_ENV=production
SESSION_COOKIE_SECURE=true
TRUST_PROXY=true
```

Make sure the same callback URL is set in both `.env` and the Discord Developer Portal.

## Database notes

This build uses PostgreSQL via `DATABASE_URL`. You can provide a CA certificate with `PGSSL_CA_PATH` or `PGSSL_CA`.
If you upgrade from an older database, the app will try to add the newer columns automatically on startup.


## New in v6

Added dashboard management for:
- YouTube, Twitch, and GitHub alerts
- economy shop items
- clearer moderation and config sections per guild

### Dashboard routes

- `/dashboard`
- `/dashboard/guild/:guildId`
- `POST /dashboard/guild/:guildId/watchers/add`
- `POST /dashboard/guild/:guildId/watchers/delete`
- `POST /dashboard/guild/:guildId/shop/add`
- `POST /dashboard/guild/:guildId/shop/delete`


## Extra fun and leveling commands

Added in this patched build:
- `/choose`
- `/rate`
- `/trivia`
- `/compliment`
- `/profile`
- `/rep`
- `/addxp`
