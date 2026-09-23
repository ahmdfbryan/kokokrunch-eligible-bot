const { SlashCommandBuilder } = require('discord.js');
const { checkEligibilityEmbed } = require('../services/eligibilityCheck');

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
    await interaction.deferReply();
    const embed = await checkEligibilityEmbed(inputUsername);
    await interaction.editReply({ embeds: [embed] });
  },
};
