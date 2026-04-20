const { EmbedBuilder } = require('discord.js');
const {
  getAllEnabledContentWatchers,
  updateContentWatcherState
} = require('./database');
const { twitchClientId, twitchClientSecret, watcherIntervalMs, githubToken } = require('../config');

let timer = null;
let twitchAccessToken = null;
let twitchAccessTokenExpiresAt = 0;

function decodeXmlEntities(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTag(text, tag) {
  const match = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXmlEntities(match[1].trim()) : '';
}

function parseYouTubeChannelId(input) {
  const value = String(input || '').trim();
  if (!value) return '';
  if (/^UC[\w-]{20,}$/.test(value)) return value;
  const match = value.match(/channel\/([\w-]+)/i);
  return match ? match[1] : value;
}

function parseGitHubRepo(input) {
  const value = String(input || '').trim().replace(/\.git$/i, '');
  if (!value) return '';
  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const url = new URL(value);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
    }
  } catch {}
  if (/^[\w.-]+\/[\w.-]+$/.test(value)) return value;
  return '';
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'discord-bot-starter-v5',
      Accept: 'application/json',
      ...(options.headers || {})
    },
    ...options
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'discord-bot-starter-v5',
      Accept: 'application/xml,text/xml,text/plain,*/*',
      ...(options.headers || {})
    },
    ...options
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function getTwitchAccessToken() {
  if (!twitchClientId || !twitchClientSecret) return null;
  if (twitchAccessToken && Date.now() < twitchAccessTokenExpiresAt - 60_000) return twitchAccessToken;

  const url = new URL('https://id.twitch.tv/oauth2/token');
  url.searchParams.set('client_id', twitchClientId);
  url.searchParams.set('client_secret', twitchClientSecret);
  url.searchParams.set('grant_type', 'client_credentials');

  const response = await fetch(url, { method: 'POST' });
  if (!response.ok) throw new Error(`Twitch token failed with ${response.status}`);
  const data = await response.json();
  twitchAccessToken = data.access_token;
  twitchAccessTokenExpiresAt = Date.now() + ((data.expires_in || 0) * 1000);
  return twitchAccessToken;
}

async function checkYouTubeWatcher(client, watcher) {
  const channelId = parseYouTubeChannelId(watcher.source_id);
  if (!channelId) return;
  const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/i);
  if (!entryMatch) return;
  const entry = entryMatch[1];
  const videoId = extractTag(entry, 'yt:videoId');
  const title = extractTag(entry, 'title');
  const published = extractTag(entry, 'published');
  const linkMatch = entry.match(/<link[^>]*href="([^"]+)"/i);
  const url = linkMatch ? linkMatch[1] : `https://www.youtube.com/watch?v=${videoId}`;
  if (!videoId || watcher.last_seen_id === videoId) return;

  const channel = await client.channels.fetch(watcher.discord_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(title || 'New YouTube upload')
    .setURL(url)
    .setDescription(`A new video was uploaded by **${watcher.source_label || channelId}**.`)
    .addFields(
      { name: 'Channel', value: watcher.source_label || channelId, inline: true },
      { name: 'Published', value: published || 'Unknown', inline: true }
    )
    .setImage(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);

  await channel.send({ embeds: [embed] });
  updateContentWatcherState(watcher.id, { last_seen_id: videoId, last_seen_at: Date.now() });
}

async function checkGitHubWatcher(client, watcher) {
  const repo = parseGitHubRepo(watcher.source_id);
  if (!repo) return;
  const headers = githubToken ? { Authorization: `Bearer ${githubToken}` } : {};
  const events = await fetchJson(`https://api.github.com/repos/${repo}/events?per_page=5`, { headers });
  if (!Array.isArray(events) || !events.length) return;
  const latest = events[0];
  if (!latest.id || watcher.last_seen_id === latest.id) return;

  const channel = await client.channels.fetch(watcher.discord_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const lines = [];
  if (latest.type === 'PushEvent' && latest.payload?.commits?.length) {
    for (const commit of latest.payload.commits.slice(0, 5)) {
      lines.push(`• ${String(commit.sha || '').slice(0, 7)} ${commit.message?.split('\n')[0] || 'Commit'}`);
    }
  } else if (latest.type === 'ReleaseEvent' && latest.payload?.release) {
    lines.push(`Release: **${latest.payload.release.name || latest.payload.release.tag_name || 'New release'}**`);
  } else if (latest.type === 'PullRequestEvent' && latest.payload?.pull_request) {
    lines.push(`${latest.payload.action || 'updated'} PR #${latest.payload.pull_request.number}: **${latest.payload.pull_request.title || 'Untitled'}**`);
  } else if (latest.type === 'IssuesEvent' && latest.payload?.issue) {
    lines.push(`${latest.payload.action || 'updated'} issue #${latest.payload.issue.number}: **${latest.payload.issue.title || 'Untitled'}**`);
  } else {
    lines.push(`Event type: **${latest.type}**`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`GitHub update for ${repo}`)
    .setURL(`https://github.com/${repo}`)
    .setDescription(lines.join('\n') || 'Repository updated.')
    .addFields({ name: 'Actor', value: latest.actor?.login || 'Unknown', inline: true })
    .setTimestamp(new Date(latest.created_at || Date.now()));

  await channel.send({ embeds: [embed] });
  updateContentWatcherState(watcher.id, { last_seen_id: latest.id, last_seen_at: Date.now(), source_label: watcher.source_label || repo });
}

async function checkTwitchWatcher(client, watcher) {
  const login = String(watcher.source_id || '').trim().toLowerCase();
  if (!login || !twitchClientId || !twitchClientSecret) return;
  const accessToken = await getTwitchAccessToken();
  if (!accessToken) return;

  const headers = {
    'Client-ID': twitchClientId,
    Authorization: `Bearer ${accessToken}`
  };

  const userData = await fetchJson(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, { headers });
  const user = userData.data?.[0];
  if (!user) return;
  const streamData = await fetchJson(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(user.id)}`, { headers });
  const stream = streamData.data?.[0];
  if (!stream) return;
  if (watcher.last_seen_id === stream.id) return;

  const channel = await client.channels.fetch(watcher.discord_channel_id).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const thumb = (stream.thumbnail_url || '').replace('{width}', '1280').replace('{height}', '720');
  const embed = new EmbedBuilder()
    .setTitle(`${watcher.source_label || login} is live on Twitch`)
    .setURL(`https://twitch.tv/${login}`)
    .setDescription(stream.title || 'Live now')
    .addFields(
      { name: 'Game', value: stream.game_name || 'Unknown', inline: true },
      { name: 'Viewer count', value: String(stream.viewer_count || 0), inline: true }
    )
    .setImage(thumb)
    .setTimestamp(new Date(stream.started_at || Date.now()));

  await channel.send({ embeds: [embed] });
  updateContentWatcherState(watcher.id, { last_seen_id: stream.id, last_seen_at: Date.now(), source_label: watcher.source_label || login });
}

async function pollAll(client) {
  const watchers = getAllEnabledContentWatchers();
  for (const watcher of watchers) {
    try {
      if (watcher.type === 'youtube') await checkYouTubeWatcher(client, watcher);
      else if (watcher.type === 'github') await checkGitHubWatcher(client, watcher);
      else if (watcher.type === 'twitch') await checkTwitchWatcher(client, watcher);
    } catch (error) {
      console.error(`Watcher ${watcher.type}:${watcher.source_id} failed:`, error.message);
    }
  }
}

function startContentWatchers(client) {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    pollAll(client).catch(error => console.error('Content watcher cycle failed:', error));
  }, Math.max(30_000, watcherIntervalMs));
  pollAll(client).catch(error => console.error('Initial content watcher cycle failed:', error));
}

module.exports = {
  startContentWatchers,
  parseYouTubeChannelId,
  parseGitHubRepo
};
