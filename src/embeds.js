const { EmbedBuilder } = require('discord.js');

const COLOR_RED = 0xed4245; // Not member / belum terdeteksi
const COLOR_ORANGE = 0xffa500; // Eligible Unverification (belum genap 14 hari)
const COLOR_GREEN = 0x57f287; // Eligible Verification (sudah >= 14 hari)

const BRAND_FOOTER = 'KokoKrunch Studios • Community Verification';

function toUnixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

function formatRemainingTime(msRemaining) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function identityFields({ robloxUsername, displayName, userId }) {
  return [
    { name: 'Username', value: `\`${robloxUsername}\``, inline: true },
    { name: 'Display Name', value: `\`${displayName}\``, inline: true },
    { name: 'Roblox ID', value: `\`${userId}\``, inline: true },
  ];
}

function buildNotJoinedEmbed({ robloxUsername, displayName, userId, avatarUrl }) {
  return new EmbedBuilder()
    .setColor(COLOR_RED)
    .setAuthor({ name: 'Community Verification' })
    .setTitle('❌ Belum Terdaftar sebagai Member')
    .addFields(...identityFields({ robloxUsername, displayName, userId }))
    .setThumbnail(avatarUrl || null)
    .setFooter({ text: BRAND_FOOTER })
    .setTimestamp();
}

function buildUnverifiedEmbed({ robloxUsername, displayName, userId, avatarUrl, joinDate, eligibleDays }) {
  const eligibleAt = new Date(joinDate.getTime() + eligibleDays * 24 * 60 * 60 * 1000);
  const { days, hours, minutes, seconds } = formatRemainingTime(eligibleAt.getTime() - Date.now());

  const joinEpoch = toUnixSeconds(joinDate);
  const eligibleEpoch = toUnixSeconds(eligibleAt);

  return new EmbedBuilder()
    .setColor(COLOR_ORANGE)
    .setAuthor({ name: 'Community Verification' })
    .setTitle('🟠 Eligible Unverification')
    .addFields(
      ...identityFields({ robloxUsername, displayName, userId }),
      { name: '📅 Bergabung Sejak', value: `<t:${joinEpoch}:F>\n<t:${joinEpoch}:R>`, inline: true },
      { name: '🎯 Eligible Pada', value: `<t:${eligibleEpoch}:F>\n<t:${eligibleEpoch}:R>`, inline: true },
      { name: '⏳ Sisa Waktu', value: `\`${days}d ${hours}h ${minutes}m ${seconds}s\``, inline: false }
    )
    .setThumbnail(avatarUrl || null)
    .setFooter({ text: BRAND_FOOTER })
    .setTimestamp();
}

function buildVerifiedEmbed({ robloxUsername, displayName, userId, avatarUrl, joinDate }) {
  const joinEpoch = toUnixSeconds(joinDate);

  return new EmbedBuilder()
    .setColor(COLOR_GREEN)
    .setAuthor({ name: 'Community Verification' })
    .setTitle('🟢 Eligible Verification')
    .addFields(
      ...identityFields({ robloxUsername, displayName, userId }),
      { name: '📅 Bergabung Sejak', value: `<t:${joinEpoch}:F>\n<t:${joinEpoch}:R>`, inline: false },
      { name: 'Status', value: '✅ **Ready For Payout**\n✅ **Verified Community**', inline: false }
    )
    .setThumbnail(avatarUrl || null)
    .setFooter({ text: BRAND_FOOTER })
    .setTimestamp();
}

function buildUserNotFoundEmbed(inputUsername) {
  return new EmbedBuilder()
    .setColor(COLOR_RED)
    .setTitle('🔴 Username Roblox Tidak Ditemukan')
    .setDescription(`Tidak ada akun Roblox dengan username \`${inputUsername}\`. Cek kembali ejaan username kamu.`)
    .setFooter({ text: BRAND_FOOTER });
}

function buildErrorEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR_RED)
    .setTitle('⚠️ Terjadi Gangguan')
    .setDescription(
      'Bot gagal terhubung ke server Roblox setelah beberapa kali percobaan. ' +
      'Ini biasanya masalah sementara di sisi Roblox — silakan coba lagi dalam beberapa saat.'
    )
    .setFooter({ text: BRAND_FOOTER });
}

module.exports = {
  buildNotJoinedEmbed,
  buildUnverifiedEmbed,
  buildVerifiedEmbed,
  buildUserNotFoundEmbed,
  buildErrorEmbed,
};
