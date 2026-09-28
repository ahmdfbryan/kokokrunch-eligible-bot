const { SlashCommandBuilder } = require('discord.js');
const { checkEligibilityEmbed } = require('../services/eligibilityCheck');
const { scheduleStickyRepost } = require('../services/stickyPanelManager');
const { syncFromResult } = require('../services/watchlistStore');
const { buildCommunityLinkRow } = require('./panel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eligible')
    .setDescription('Cek apakah user Roblox sudah eligible (join komunitas >= 14 hari)')
    .addStringOption((option) =>
      option
        .setName('username')
        .setDescription('Username Roblox yang ingin dicek')
        .setRequired(true)
    ),

  async execute(interaction) {
    const inputUsername = interaction.options.getString('username', true).trim();
    const guildIconUrl = interaction.guild?.iconURL({ size: 128 }) || null;
    const botAvatarUrl = interaction.client.user.displayAvatarURL({ size: 128 });

    await interaction.deferReply();
    const { embed, result } = await checkEligibilityEmbed(inputUsername, { guildIconUrl, botAvatarUrl });
    const components = result?.status === 'not_joined' ? [buildCommunityLinkRow()] : [];
    await interaction.editReply({ embeds: [embed], components });

    syncFromResult(result, { channelId: interaction.channelId, discordUserId: interaction.user.id });

    scheduleStickyRepost(interaction.client, interaction.channelId);
  },
};
