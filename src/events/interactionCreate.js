const { ChannelType } = require('discord.js');
const { createTicket } = require('../utils/tickets');
const { handleGiveawayButton } = require('../utils/giveaways');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        await command.execute(interaction, client);
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category_select') {
        const selected = interaction.values[0];
        await createTicket(interaction, selected);
        return;
      }

      if (interaction.isButton() && interaction.customId === 'ticket_close') {
        await interaction.reply({ content: 'Closing ticket in 5 seconds...', ephemeral: true });

        setTimeout(async () => {
          await interaction.channel.delete().catch(() => null);
        }, 5000);

        return;
      }

      if (interaction.isButton()) {
        const handledGiveaway = await handleGiveawayButton(interaction);
        if (handledGiveaway) return;
      }
    } catch (error) {
      console.error(error);

      if (interaction.replied || interaction.deferred) {
        await interaction
          .followUp({
            content: 'There was an error while running that interaction.',
            ephemeral: true
          })
          .catch(() => null);
      } else if (interaction.channel?.type === ChannelType.DM || interaction.guild) {
        await interaction
          .reply({
            content: 'There was an error while running that interaction.',
            ephemeral: true
          })
          .catch(() => null);
      }
    }
  }
};