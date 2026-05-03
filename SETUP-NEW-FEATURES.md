# Added features in this build

## Important: commands in all servers
This build registers slash commands globally by default, so commands can be used in every server the bot is invited to.

If you want fast test-guild-only registration instead, add this to `.env`:

```env
REGISTER_GLOBAL_COMMANDS=false
GUILD_ID=YOUR_TEST_SERVER_ID
```

Global Discord slash commands can take up to 1 hour to appear after the bot starts.

## New dashboard settings
Open the dashboard, pick a server, then configure:

- Prefix
- Welcome channel/message
- Leave channel/message
- Verification channel/role/message
- Auto role
- Full log channel
- Join/leave logs
- Message delete logs
- Command logs

## Prefix music commands
Music commands now work with:

```txt
/play query
!play query
?play query
```

The dashboard prefix also works. Example: if the prefix is `$`, `$play never gonna give you up` works too.

Supported prefix music commands:

```txt
!play, !skip, !stop, !pause, !resume, !queue, !nowplaying, !volume
?play, ?skip, ?stop, ?pause, ?resume, ?queue, ?nowplaying, ?volume
```

## Verification
Use the dashboard settings or this command:

```txt
/verificationpanel channel:#verify role:@Member message:Click to verify
```

The bot must have **Manage Roles**, and the bot role must be above the verified role.

## Welcome / leave
Use the dashboard or:

```txt
/welcomesetup welcome_channel:#welcome welcome_message:Welcome {user} to {server}!
/welcomesetup leave_channel:#logs leave_message:{username} left {server}.
```

Placeholders:

```txt
{user}, {username}, {tag}, {server}, {memberCount}
```

## Auto role
Use the dashboard or:

```txt
/autorolesetup role:@Member
```

The bot must have **Manage Roles**, and the bot role must be above the auto role.

## Ticket transcripts
When someone clicks **Close Ticket**, the bot now saves a `.txt` transcript before deleting the channel.

The transcript goes to:

1. `log_channel_id` if set
2. `mod_log_channel_id` if set
3. The ticket channel itself if no log channel is set

## Logging system
The bot can log:

- member join/leave
- command usage
- deleted messages
- ticket close transcripts

Set `log_channel_id` in the dashboard for the best result.

## Music notes
The music system uses `yt-dlp` and `ffmpeg`.

On Ubuntu install them with:

```bash
sudo apt update
sudo apt install -y ffmpeg python3-pip
python3 -m pip install -U yt-dlp --break-system-packages
```

Then in `.env` you can use:

```env
YTDLP_PATH=yt-dlp
FFMPEG_PATH=ffmpeg
MUSIC_PLAYLIST_LIMIT=100
```
