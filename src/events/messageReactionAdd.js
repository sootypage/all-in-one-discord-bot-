const { getReactionRole } = require('../utils/featureStore');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    if (user.bot) return;

    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
    } catch {
      return;
    }

    const guild = reaction.message.guild;
    if (!guild) return;

    const key = reaction.emoji.id || reaction.emoji.name;
    const record = await getReactionRole(guild.id, reaction.message.id, key);
    if (!record) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    await member.roles.add(record.role_id).catch(() => {});
  }
};