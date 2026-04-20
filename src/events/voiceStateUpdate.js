const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { addTempChannel, getGuildSettings, getTempChannel, removeTempChannel } = require('../utils/database');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    const settings = getGuildSettings(guild.id);
    const joinToCreateId = settings.temp_vc_create_channel_id;

    if (joinToCreateId && newState.channelId === joinToCreateId && newState.member) {
      const channel = await guild.channels.create({
        name: `${newState.member.user.username}'s VC`,
        type: ChannelType.GuildVoice,
        parent: settings.temp_vc_category_id || null,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Speak]
          },
          {
            id: newState.member.id,
            allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers]
          }
        ]
      });

      addTempChannel(guild.id, channel.id, newState.member.id);
      await newState.setChannel(channel).catch(() => null);
    }

    const oldChannelId = oldState.channelId;
    if (!oldChannelId) return;

    const temp = getTempChannel(oldChannelId);
    if (!temp) return;

    const oldChannel = guild.channels.cache.get(oldChannelId);
    if (!oldChannel || oldChannel.type !== ChannelType.GuildVoice) {
      removeTempChannel(oldChannelId);
      return;
    }

    if (oldChannel.members.size === 0) {
      removeTempChannel(oldChannelId);
      await oldChannel.delete().catch(() => null);
    }
  }
};
