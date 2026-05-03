const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const { initDatabase } = require('./utils/database');
const { initFeatureStore } = require('./utils/featureStore');
const { loadCommands } = require('./handlers/loadCommands');
const { registerCommands } = require('./handlers/registerCommands');
const { startDashboard } = require('./dashboard/server');
const { startContentWatchers } = require('./utils/contentWatchers');
const { startGiveawayWatcher } = require('./utils/giveaways');

function enforceProductionConfig() {
  if (config.nodeEnv !== 'production') return;

  const problems = [];

  if (!config.baseUrl?.startsWith('https://')) {
    problems.push('BASE_URL should use https:// in production.');
  }

  if (config.adminPassword === 'change_this_admin_password') {
    problems.push('ADMIN_PASSWORD must be changed in production.');
  }

  if (!config.sessionSecret || config.sessionSecret === 'change_me') {
    problems.push('SESSION_SECRET must be changed in production.');
  }

  if (problems.length) {
    throw new Error(`Production startup blocked:\n- ${problems.join('\n- ')}`);
  }
}

(async () => {
  try {
    enforceProductionConfig();
    await initDatabase();
    await initFeatureStore();

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
      ]
    });

    client.commands = new Collection();

    loadCommands(client);

    const eventFiles = [
      './events/ready',
      './events/interactionCreate',
      './events/messageCreate',
      './events/voiceStateUpdate',
      './events/messageReactionAdd',
      './events/messageReactionRemove',
      './events/guildMemberAdd',
      './events/guildMemberRemove',
      './events/messageDelete'
    ];

    for (const file of eventFiles) {
      const event = require(file);
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
    }

    await registerCommands(client);
    startDashboard(client);
    startContentWatchers(client);
    startGiveawayWatcher(client);

    await client.login(config.token);
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
})();