const { handleMemberJoin } = require('../utils/guildSystems');
module.exports = { name: 'guildMemberAdd', async execute(member, client) { await handleMemberJoin(member, client); } };
