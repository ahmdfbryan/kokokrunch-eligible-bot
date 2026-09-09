const { SlashCommandBuilder } = require('discord.js');
const config = require('../config');
const roblox = require('../roblox');
const {
  buildNotJoinedEmbed,
  buildUnverifiedEmbed,
  buildVerifiedEmbed,
  buildUserNotFoundEmbed,
  buildErrorEmbed,
} = require('../embeds');

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

    // defer supaya Discord tidak timeout 3 detik sementara kita panggil API Roblox
    await interaction.deferReply();

    try {
      const resolved = await roblox.resolveUsername(inputUsername);
      if (!resolved) {
        await interaction.editReply({ embeds: [buildUserNotFoundEmbed(inputUsername)] });
        return;
      }

      const [avatarUrl, membership] = await Promise.all([
        roblox.getAvatarUrl(resolved.userId),
        roblox.checkMembership(resolved.userId),
      ]);

      if (!membership.isMember) {
  await interaction.editReply({
    embeds: [
      buildNotJoinedEmbed({
        robloxUsername: resolved.username,
        displayName: resolved.displayName,
        userId: resolved.userId,
        avatarUrl,
      }),
    ],
  });
  return;
}

      const daysSinceJoin = (Date.now() - membership.joinDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceJoin >= config.eligibleDays) {
  await interaction.editReply({
    embeds: [
      buildVerifiedEmbed({
        robloxUsername: resolved.username,
        displayName: resolved.displayName,
        userId: resolved.userId,
        avatarUrl,
        joinDate: membership.joinDate,
      }),
    ],
  });
} else {
  await interaction.editReply({
    embeds: [
      buildUnverifiedEmbed({
        robloxUsername: resolved.username,
        displayName: resolved.displayName,
        userId: resolved.userId,
        avatarUrl,
        joinDate: membership.joinDate,
        eligibleDays: config.eligibleDays,
      }),
    ],
  });
}
    } catch (err) {
      console.error(`[Command /eligible] Gagal memproses username "${inputUsername}":`, err);
      await interaction.editReply({ embeds: [buildErrorEmbed()] });
    }
  },
};
