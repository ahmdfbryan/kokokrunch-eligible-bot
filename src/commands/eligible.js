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
    // Lapisan kedua pembatas channel (lapisan pertama diatur di Discord ->
    // Server Settings -> Integrations). Jaga-jaga kalau pengaturan Discord-nya
    // berubah / command dipanggil dari channel lain.
    if (config.allowedChannelId && interaction.channelId !== config.allowedChannelId) {
      await interaction.reply({
        content: `Command ini hanya bisa dipakai di <#${config.allowedChannelId}>.`,
        ephemeral: true,
      });
      return;
    }

    const inputUsername = interaction.options.getString('username', true).trim();

    // Ikon server & bot -> dipakai untuk mempercantik author/footer embed
    const guildIconUrl = interaction.guild?.iconURL({ size: 128 }) || null;
    const botAvatarUrl = interaction.client.user.displayAvatarURL({ size: 128 });

    // defer supaya Discord tidak timeout 3 detik sementara kita panggil API Roblox
    await interaction.deferReply();

    try {
      const resolved = await roblox.resolveUsername(inputUsername);
      if (!resolved) {
        await interaction.editReply({ embeds: [buildUserNotFoundEmbed(inputUsername, { botAvatarUrl })] });
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
              guildIconUrl,
              botAvatarUrl,
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
              guildIconUrl,
              botAvatarUrl,
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
              guildIconUrl,
              botAvatarUrl,
            }),
          ],
        });
      }
    } catch (err) {
      console.error(`[Command /eligible] Gagal memproses username "${inputUsername}":`, err);
      await interaction.editReply({ embeds: [buildErrorEmbed({ botAvatarUrl })] });
    }
  },
};
