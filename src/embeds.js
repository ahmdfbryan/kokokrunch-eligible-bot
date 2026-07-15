const { EmbedBuilder } = require('discord.js');

const COLOR_RED = 0xed4245; // Not member / belum terdeteksi
const COLOR_ORANGE = 0xffa500; // Eligible Unverification (belum genap 14 hari)
const COLOR_GREEN = 0x57f287; // Eligible Verification (sudah >= 14 hari)

function formatRemainingTime(msRemaining) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

/** Kondisi 1: user tidak ditemukan sebagai member komunitas sama sekali */
function buildNotJoinedEmbed({ robloxUsername, avatarUrl }) {
  return new EmbedBuilder()
    .setColor(COLOR_RED)
    .setTitle('🔴 User Belum Terdeteksi Join Komunitas')
    .setDescription(`**${robloxUsername}**`)
    .setThumbnail(avatarUrl || null)
    .setFooter({ text: 'Community Member' })
    .setTimestamp();
}

/** Kondisi 2: member tapi belum genap N hari (default 14) */
function buildUnverifiedEmbed({ robloxUsername, avatarUrl, joinDate, eligibleDays }) {
  const eligibleAt = new Date(joinDate.getTime() + eligibleDays * 24 * 60 * 60 * 1000);
  const { days, hours, minutes, seconds } = formatRemainingTime(eligibleAt.getTime() - Date.now());

  return new EmbedBuilder()
    .setColor(COLOR_ORANGE)
    .setTitle('🟠 Eligible Unverification')
    .setDescription(`**${robloxUsername}**`)
    .addFields({
      name: 'Remaining Time',
      value: `${days} Days ${hours} Hours\n${minutes} Minutes ${seconds} Seconds`,
    })
    .setThumbnail(avatarUrl || null)
    .setFooter({ text: 'Community Member' })
    .setTimestamp();
}

/** Kondisi 3: member dan sudah >= N hari -> lolos verifikasi */
function buildVerifiedEmbed({ robloxUsername, avatarUrl }) {
  return new EmbedBuilder()
    .setColor(COLOR_GREEN)
    .setTitle('🟢 Eligible Verification')
    .setDescription(`**${robloxUsername}**\n\n✅ **Ready For Payout**\n✅ **Verified Community**`)
    .setThumbnail(avatarUrl || null)
    .setFooter({ text: 'Community Member' })
    .setTimestamp();
}

function buildUserNotFoundEmbed(inputUsername) {
  return new EmbedBuilder()
    .setColor(COLOR_RED)
    .setTitle('🔴 Username Roblox Tidak Ditemukan')
    .setDescription(`Tidak ada akun Roblox dengan username \`${inputUsername}\`. Cek kembali ejaan username kamu.`);
}

function buildErrorEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR_RED)
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
