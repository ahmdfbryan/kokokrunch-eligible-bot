const { SlashCommandBuilder } = require('discord.js');
const { checkEligibilityEmbed } = require('../services/eligibilityCheck');
const { scheduleStickyRepost } = require('../services/stickyPanelManager');

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
    const embed = await checkEligibilityEmbed(inputUsername, { guildIconUrl, botAvatarUrl });
    await interaction.editReply({ embeds: [embed] });

    scheduleStickyRepost(interaction.client, interaction.channelId);
  },
};
