const { EmbedBuilder } = require('discord.js');

const COLOR_RED = 0xed4245;
const COLOR_ORANGE = 0xffa500;
const COLOR_GREEN = 0x57f287;
const AUTHOR_NAME = 'KokoKrunch Studios';
const FOOTER_TEXT = 'Automated Verification System';
const PROGRESS_BAR_LENGTH = 14;

function toUnixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

function robloxProfileUrl(userId) {
  return `https://www.roblox.com/users/${userId}/profile`;
}

function buildProgressBar(currentDays, totalDays, length = PROGRESS_BAR_LENGTH) {
  const ratio = Math.max(0, Math.min(1, currentDays / totalDays));
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  return '🟩'.repeat(filled) + '⬛'.repeat(empty);
}

function dividerField() {
  return { name: '\u200b', value: '\u200b', inline: false };
}

function identityFields({ robloxUsername, displayName, userId }) {
  return [
    { name: '👤 Username', value: `\`${robloxUsername}\``, inline: true },
    { name: '🪪 Display Name', value: `\`${displayName || robloxUsername}\``, inline: true },
    { name: '🆔 Roblox ID', value: `\`${userId}\``, inline: true },
  ];
}

function baseEmbed({ color, guildIconUrl, botAvatarUrl }) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setFooter({ text: FOOTER_TEXT, iconURL: botAvatarUrl || undefined })
    .setTimestamp();
  if (guildIconUrl) {
    embed.setAuthor({ name: AUTHOR_NAME, iconURL: guildIconUrl });
  } else {
    embed.setAuthor({ name: AUTHOR_NAME });
  }
  return embed;
}

/** Kondisi 1: user tidak ditemukan sebagai member komunitas sama sekali */
function buildNotJoinedEmbed({ robloxUsername, displayName, userId, avatarUrl, guildIconUrl, botAvatarUrl }) {
  const embed = baseEmbed({ color: COLOR_RED, guildIconUrl, botAvatarUrl })
    .setTitle('🔴 Belum Terdeteksi Join Komunitas')
    .setURL(robloxProfileUrl(userId))
    .addFields(...identityFields({ robloxUsername, displayName, userId }))
    .addFields(dividerField())
    .addFields({
      name: 'Status',
      value: '❌ Belum tergabung di komunitas KokoKrunch Studios.\nSilakan join terlebih dahulu melalui tombol link komunitas.',
    });
  if (avatarUrl) embed.setThumbnail(avatarUrl);
  return embed;
}

/** Kondisi 2: member tapi belum genap N hari */
function buildUnverifiedEmbed({ robloxUsername, displayName, userId, avatarUrl, joinDate, eligibleDays, guildIconUrl, botAvatarUrl }) {
  const eligibleAt = new Date(joinDate.getTime() + eligibleDays * 24 * 60 * 60 * 1000);
  const daysSinceJoin = (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24);
  const progressBar = buildProgressBar(daysSinceJoin, eligibleDays);

  const embed = baseEmbed({ color: COLOR_ORANGE, guildIconUrl, botAvatarUrl })
    .setTitle('🟠 Eligible Unverification')
    .setURL(robloxProfileUrl(userId))
    .addFields(...identityFields({ robloxUsername, displayName, userId }))
    .addFields(dividerField())
    .addFields(
      { name: 'Tanggal Bergabung', value: `<t:${toUnixSeconds(joinDate)}:F>`, inline: false },
      { name: 'Eligible Pada', value: `<t:${toUnixSeconds(eligibleAt)}:F> (<t:${toUnixSeconds(eligibleAt)}:R>)`, inline: false },
      { name: 'Progress', value: `${progressBar}\n${Math.max(0, Math.floor(daysSinceJoin))} / ${eligibleDays} hari`, inline: false }
    );
  if (avatarUrl) embed.setThumbnail(avatarUrl);
  return embed;
}

/** Kondisi 3: member dan sudah >= N hari -> lolos verifikasi */
function buildVerifiedEmbed({ robloxUsername, displayName, userId, avatarUrl, joinDate, guildIconUrl, botAvatarUrl }) {
  const embed = baseEmbed({ color: COLOR_GREEN, guildIconUrl, botAvatarUrl })
    .setTitle('🟢 Eligible Verification')
    .setURL(robloxProfileUrl(userId))
    .setDescription('🎉 **Selamat! Kamu sudah memenuhi syarat verifikasi komunitas.**')
    .addFields(...identityFields({ robloxUsername, displayName, userId }))
    .addFields(dividerField())
    .addFields(
      { name: 'Bergabung Sejak', value: `<t:${toUnixSeconds(joinDate)}:F>`, inline: false },
      { name: 'Status', value: '✅ Verified Community Member\n✅ Ready For Payout', inline: false }
    );
  if (avatarUrl) embed.setThumbnail(avatarUrl);
  return embed;
}

function buildUserNotFoundEmbed(inputUsername, { botAvatarUrl } = {}) {
  return baseEmbed({ color: COLOR_RED, botAvatarUrl })
    .setTitle('🔴 Username Roblox Tidak Ditemukan')
    .setDescription(`Tidak ada akun Roblox dengan username \`${inputUsername}\`. Cek kembali ejaan username kamu.`);
}

function buildErrorEmbed({ botAvatarUrl } = {}) {
  return baseEmbed({ color: COLOR_RED, botAvatarUrl })
    .setTitle('⚠️ Terjadi Gangguan')
    .setDescription(
      'Bot gagal terhubung ke server Roblox setelah beberapa kali percobaan. ' +
      'Ini biasanya masalah sementara di sisi Roblox — silakan coba lagi dalam beberapa saat.'
    );
}

module.exports = {
  buildNotJoinedEmbed,
  buildUnverifiedEmbed,
  buildVerifiedEmbed,
  buildUserNotFoundEmbed,
  buildErrorEmbed,
};
