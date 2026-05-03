const { logMessageDelete } = require('../utils/guildSystems');
module.exports = { name: 'messageDelete', async execute(message, client) { await logMessageDelete(message, client); } };
