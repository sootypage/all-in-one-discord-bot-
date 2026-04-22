const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  getVoiceConnection,
  entersState,
  VoiceConnectionStatus,
  StreamType
} = require('@discordjs/voice');
const { spawn } = require('child_process');

const queues = new Map();

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const PLAYLIST_LIMIT = Number(process.env.MUSIC_PLAYLIST_LIMIT || 100);

function getGuildQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      textChannel: null,
      voiceChannel: null,
      connection: null,
      player: null,
      songs: [],
      volume: 0.5,
      playing: false,
      current: null,
      ytDlpProcess: null,
      ffmpegProcess: null
    });
  }
  return queues.get(guildId);
}

async function createConnection(voiceChannel) {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  return connection;
}

function cleanupProcesses(queue) {
  if (queue.ytDlpProcess) {
    try {
      if (!queue.ytDlpProcess.killed) {
        queue.ytDlpProcess.kill('SIGKILL');
      }
    } catch {}
    queue.ytDlpProcess = null;
  }

  if (queue.ffmpegProcess) {
    try {
      if (!queue.ffmpegProcess.killed) {
        queue.ffmpegProcess.kill('SIGKILL');
      }
    } catch {}
    queue.ffmpegProcess = null;
  }
}

function buildPlayer(guildId) {
  const queue = getGuildQueue(guildId);

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause
    }
  });

  player.on(AudioPlayerStatus.Idle, async () => {
    cleanupProcesses(queue);
    queue.songs.shift();
    queue.current = null;

    if (queue.songs.length > 0) {
      await playNext(guildId);
    } else {
      queue.playing = false;
    }
  });

  player.on('error', async (error) => {
    console.error(`Music player error in guild ${guildId}:`, error);
    cleanupProcesses(queue);
    queue.songs.shift();
    queue.current = null;

    if (queue.songs.length > 0) {
      await playNext(guildId);
    } else {
      queue.playing = false;
    }
  });

  return player;
}

function isYoutubeUrl(input) {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(String(input || ''));
}

function looksLikePlaylistUrl(input) {
  const text = String(input || '');
  return isYoutubeUrl(text) && (text.includes('list=') || text.includes('/playlist'));
}

async function searchYoutube(query) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      YTDLP_PATH,
      ['--dump-single-json', '--no-playlist', `ytsearch1:${query}`],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => {
      stdout += d.toString();
    });

    proc.stderr.on('data', d => {
      stderr += d.toString();
    });

    proc.on('error', err => {
      reject(new Error(`yt-dlp search spawn failed: ${err.message}`));
    });

    proc.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp search failed: ${stderr || `exit code ${code}`}`));
      }

      try {
        const json = JSON.parse(stdout);

        const first =
          Array.isArray(json.entries) && json.entries.length
            ? json.entries[0]
            : json;

        const realUrl =
          first?.webpage_url ||
          (first?.id ? `https://www.youtube.com/watch?v=${first.id}` : null);

        if (!realUrl || !String(realUrl).startsWith('http')) {
          return reject(new Error('No valid YouTube result URL found.'));
        }

        resolve(realUrl);
      } catch (err) {
        reject(err);
      }
    });
  });
}

function getJsonFromYtDlp(args, label) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => {
      stdout += d.toString();
    });

    proc.stderr.on('data', d => {
      stderr += d.toString();
    });

    proc.on('error', err => {
      reject(new Error(`${label} spawn failed: ${err.message}`));
    });

    proc.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`${label} failed: ${stderr || `exit code ${code}`}`));
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function resolveSong(query, requestedBy) {
  let url = query;

  if (!isYoutubeUrl(query)) {
    url = await searchYoutube(query);
  }

  const info = await getVideoInfo(url);

  return {
    title: info.title || 'Unknown title',
    url,
    duration: info.duration || 'Unknown',
    requestedBy
  };
}

async function resolvePlaylist(url, requestedBy) {
  const json = await getJsonFromYtDlp(
    ['--dump-single-json', '--flat-playlist', '--playlist-end', String(PLAYLIST_LIMIT), url],
    'yt-dlp playlist'
  );

  const entries = Array.isArray(json.entries) ? json.entries : [];
  const songs = entries
    .map(entry => normalizePlaylistEntry(entry, requestedBy))
    .filter(Boolean);

  return {
    title: json.title || 'Playlist',
    songs
  };
}

function normalizePlaylistEntry(entry, requestedBy) {
  if (!entry) return null;

  const url =
    entry.url && String(entry.url).startsWith('http')
      ? entry.url
      : entry.id
        ? `https://www.youtube.com/watch?v=${entry.id}`
        : entry.webpage_url;

  if (!url || !String(url).startsWith('http')) return null;

  return {
    title: entry.title || 'Unknown title',
    url,
    duration: entry.duration ? formatDuration(entry.duration) : 'Unknown',
    requestedBy
  };
}

async function getVideoInfo(url) {
  const json = await getJsonFromYtDlp(
    ['--dump-single-json', '--no-playlist', url],
    'yt-dlp info'
  );

  return {
    title: json.title,
    duration: formatDuration(json.duration)
  };
}

async function addSong(interaction, query) {
  const memberVoice = interaction.member.voice.channel;
  if (!memberVoice) {
    throw new Error('You need to be in a voice channel first.');
  }

  const queue = getGuildQueue(interaction.guild.id);
  queue.textChannel = interaction.channel;
  queue.voiceChannel = memberVoice;

  let addedSongs = [];
  let playlistInfo = null;

  if (looksLikePlaylistUrl(query)) {
    playlistInfo = await resolvePlaylist(query, interaction.user.id);
    addedSongs = playlistInfo.songs;

    if (!addedSongs.length) {
      throw new Error('No playable songs were found in that playlist.');
    }

    queue.songs.push(...addedSongs);
  } else {
    const song = await resolveSong(query, interaction.user.id);
    addedSongs = [song];
    queue.songs.push(song);
  }

  if (!queue.connection) {
    queue.connection = await createConnection(memberVoice);
  }

  if (!queue.player) {
    queue.player = buildPlayer(interaction.guild.id);
    queue.connection.subscribe(queue.player);
  }

  const started = !queue.playing;
  if (!queue.playing) {
    queue.playing = true;
    await playNext(interaction.guild.id);
  }

  return {
    song: addedSongs[0],
    addedSongs,
    addedCount: addedSongs.length,
    started,
    isPlaylist: Boolean(playlistInfo),
    playlistTitle: playlistInfo?.title || null
  };
}

async function playNext(guildId) {
  const queue = getGuildQueue(guildId);
  const nextSong = queue.songs[0];

  if (!nextSong) {
    queue.playing = false;
    return;
  }

  if (!queue.connection || queue.connection.state.status === 'destroyed') {
    queue.connection = await createConnection(queue.voiceChannel);
  }

  cleanupProcesses(queue);

  console.log('Attempting to play:', nextSong);
  console.log('Using yt-dlp path:', YTDLP_PATH);
  console.log('Using ffmpeg path:', FFMPEG_PATH);

  const ytDlp = spawn(
    YTDLP_PATH,
    ['-f', 'bestaudio', '-o', '-', '--no-playlist', nextSong.url],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  ytDlp.stderr.on('data', d => {
    const msg = d.toString().trim();
    if (msg) console.log('[yt-dlp]', msg);
  });

  ytDlp.on('error', err => {
    console.error('yt-dlp spawn error:', err);
  });

  const ffmpeg = spawn(
    FFMPEG_PATH,
    [
      '-analyzeduration', '0',
      '-loglevel', '0',
      '-i', 'pipe:0',
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1'
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  );

  ffmpeg.stderr.on('data', d => {
    const msg = d.toString().trim();
    if (msg) console.log('[ffmpeg]', msg);
  });

  ffmpeg.on('error', err => {
    console.error('ffmpeg spawn error:', err);
  });

  ytDlp.stdout.on('error', err => {
    if (err.code !== 'EPIPE') {
      console.error('yt-dlp stdout error:', err);
    }
  });

  ffmpeg.stdin.on('error', err => {
    if (err.code !== 'EPIPE' && err.code !== 'ERR_STREAM_DESTROYED') {
      console.error('ffmpeg stdin error:', err);
    }
  });

  ytDlp.on('close', () => {
    try {
      ffmpeg.stdin.end();
    } catch {}
  });

  ytDlp.stdout.pipe(ffmpeg.stdin);

  queue.ytDlpProcess = ytDlp;
  queue.ffmpegProcess = ffmpeg;

  const resource = createAudioResource(ffmpeg.stdout, {
    inputType: StreamType.Raw,
    inlineVolume: true
  });

  if (resource.volume) {
    resource.volume.setVolume(queue.volume);
  }

  queue.current = nextSong;
  queue.player.play(resource);
}

function skipSong(guildId) {
  const queue = getGuildQueue(guildId);
  if (!queue.player || !queue.songs.length) return false;

  cleanupProcesses(queue);
  queue.player.stop();
  return true;
}

function stopMusic(guildId) {
  const queue = getGuildQueue(guildId);

  queue.songs = [];
  queue.current = null;
  queue.playing = false;

  cleanupProcesses(queue);

  if (queue.player) {
    queue.player.stop();
  }

  const connection = getVoiceConnection(guildId);
  if (connection) {
    connection.destroy();
  }

  queue.connection = null;
  return true;
}

function pauseMusic(guildId) {
  const queue = getGuildQueue(guildId);
  if (!queue.player) return false;
  return queue.player.pause();
}

function resumeMusic(guildId) {
  const queue = getGuildQueue(guildId);
  if (!queue.player) return false;
  return queue.player.unpause();
}

function setVolume(guildId, amount) {
  const queue = getGuildQueue(guildId);
  queue.volume = Math.max(0, Math.min(2, amount));

  const resource = queue.player?.state?.resource;
  if (resource?.volume) {
    resource.volume.setVolume(queue.volume);
  }

  return queue.volume;
}

function getQueue(guildId) {
  return getGuildQueue(guildId);
}

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(seconds)) return 'Unknown';

  const s = Number(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  return `${m}:${String(sec).padStart(2, '0')}`;
}

module.exports = {
  addSong,
  skipSong,
  stopMusic,
  pauseMusic,
  resumeMusic,
  setVolume,
  getQueue
};