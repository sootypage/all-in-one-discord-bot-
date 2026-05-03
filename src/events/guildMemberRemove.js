const { handleMemberLeave } = require('../utils/guildSystems');
module.exports = { name: 'guildMemberRemove', async execute(member, client) { await handleMemberLeave(member, client); } };
