const { ChannelType } = require('discord.js');
const { createTicket } = require('../utils/tickets');
const { handleGiveawayButton } = require('../utils/giveaways');
const { handleVerify, logCommand, createTicketTranscript, sendConfiguredLog } = require('../utils/guildSystems');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        await command.execute(interaction, client);
        await logCommand(client, interaction, `/${interaction.commandName}`);
        return;
      }

      if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category_select') {
        const selected = interaction.values[0];
        await createTicket(interaction, selected);
        return;
      }

      if (interaction.isButton() && interaction.customId === 'ticket_close') {
        await interaction.reply({ content: 'Saving transcript and closing ticket in 5 seconds...', ephemeral: true });

        const transcript = await createTicketTranscript(interaction.channel);
        const embed = new EmbedBuilder()
          .setTitle('Ticket Closed')
          .setDescription(`Ticket ${interaction.channel.name} was closed by ${interaction.user}.`)
          .addFields(
            { name: 'Channel ID', value: interaction.channel.id, inline: true },
            { name: 'Closed By', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false }
          )
          .setTimestamp();

        const sent = await sendConfiguredLog(client, interaction.guild.id, embed);
        if (sent) {
          const settings = require('../utils/database').getGuildSettings(interaction.guild.id);
          const channelId = settings.log_channel_id || settings.mod_log_channel_id;
          const logChannel = await client.channels.fetch(channelId).catch(() => null);
          if (logChannel?.isTextBased()) await logChannel.send({ files: [transcript] }).catch(() => null);
        } else {
          await interaction.channel.send({ content: 'Transcript saved before close:', files: [transcript] }).catch(() => null);
        }

        setTimeout(async () => {
          await interaction.channel.delete().catch(() => null);
        }, 5000);

        return;
      }

      if (interaction.isButton() && interaction.customId === 'verify_member') {
        await handleVerify(interaction);
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