const { EmbedBuilder } = require('discord.js');

const COLOR_RED = 0xed4245; // Not member / belum terdeteksi
const COLOR_ORANGE = 0xffa500; // Eligible Unverification (belum genap 14 hari)
const COLOR_GREEN = 0x57f287; // Eligible Verification (sudah >= 14 hari)

const AUTHOR_NAME = 'KokoKrunch Studios — Community Verification';
const FOOTER_TEXT = 'Automated Verification System';
const PROGRESS_BAR_LENGTH = 14;

function toUnixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

function robloxProfileUrl(userId) {
  return `https://www.roblox.com/users/${userId}/profile`;
}

function formatRemainingTime(msRemaining) {
  const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

/** Progress bar visual pakai unicode block characters, misal: ████████░░░░░░ */
function buildProgressBar(currentDays, totalDays, length = PROGRESS_BAR_LENGTH) {
  const ratio = Math.min(1, Math.max(0, currentDays / totalDays));
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/** Divider tipis pemisah antar blok, dibuat pakai field kosong (zero-width space) */
function dividerField() {
  return { name: '\u200b', value: '⎯'.repeat(38), inline: false };
}

/** 3 field identitas, konsisten dipakai di semua kondisi */
function identityFields({ robloxUsername, displayName, userId }) {
  return [
    { name: '🎮 Username', value: `\`${robloxUsername}\``, inline: true },
    { name: '🪪 Display Name', value: `\`${displayName}\``, inline: true },
    { name: '🆔 Roblox ID', value: `\`${userId}\``, inline: true },
  ];
}

function baseEmbed({ color, guildIconUrl, botAvatarUrl }) {
  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: AUTHOR_NAME, iconURL: guildIconUrl || undefined })
    .setFooter({ text: FOOTER_TEXT, iconURL: botAvatarUrl || undefined })
    .setTimestamp();
}

/** Kondisi 1: user tidak ditemukan sebagai member komunitas sama sekali */
function buildNotJoinedEmbed({ robloxUsername, displayName, userId, avatarUrl, guildIconUrl, botAvatarUrl }) {
  return baseEmbed({ color: COLOR_RED, guildIconUrl, botAvatarUrl })
    .setTitle('❌ Belum Terdaftar sebagai Member')
    .setURL(robloxProfileUrl(userId))
    .setDescription('-# Hasil pengecekan otomatis via Roblox Open Cloud')
    .addFields(...identityFields({ robloxUsername, displayName, userId }))
    .setThumbnail(avatarUrl || null);
}

/** Kondisi 2: member tapi belum genap N hari (default 14) */
function buildUnverifiedEmbed({
  robloxUsername,
  displayName,
  userId,
  avatarUrl,
  joinDate,
  eligibleDays,
  guildIconUrl,
  botAvatarUrl,
}) {
  const eligibleAt = new Date(joinDate.getTime() + eligibleDays * 24 * 60 * 60 * 1000);
  const { days, hours, minutes, seconds } = formatRemainingTime(eligibleAt.getTime() - Date.now());

  const daysSinceJoin = Math.min(eligibleDays, (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
  const progressBar = buildProgressBar(daysSinceJoin, eligibleDays);

  const joinEpoch = toUnixSeconds(joinDate);
  const eligibleEpoch = toUnixSeconds(eligibleAt);

  return baseEmbed({ color: COLOR_ORANGE, guildIconUrl, botAvatarUrl })
    .setTitle('🟠 Eligible Unverification')
    .setURL(robloxProfileUrl(userId))
    .setDescription('-# Hasil pengecekan otomatis via Roblox Open Cloud')
    .addFields(
      ...identityFields({ robloxUsername, displayName, userId }),
      dividerField(),
      {
        name: `📈 Progress Menuju Eligible (${Math.floor(daysSinceJoin)}/${eligibleDays} hari)`,
        value: `\`${progressBar}\``,
        inline: false,
      },
      { name: '📅 Bergabung Sejak', value: `<t:${joinEpoch}:F>\n<t:${joinEpoch}:R>`, inline: true },
      { name: '🎯 Eligible Pada', value: `<t:${eligibleEpoch}:F>\n<t:${eligibleEpoch}:R>`, inline: true },
      {
        name: '⏳ Sisa Waktu',
        value: `\`\`\`\n${days}h ${hours}j ${minutes}m ${seconds}d\n\`\`\``,
        inline: false,
      }
    )
    .setThumbnail(avatarUrl || null);
}

/** Kondisi 3: member dan sudah >= N hari -> lolos verifikasi */
function buildVerifiedEmbed({ robloxUsername, displayName, userId, avatarUrl, joinDate, guildIconUrl, botAvatarUrl }) {
  const joinEpoch = toUnixSeconds(joinDate);

  return baseEmbed({ color: COLOR_GREEN, guildIconUrl, botAvatarUrl })
    .setTitle('🟢 Eligible Verification')
    .setURL(robloxProfileUrl(userId))
    .setDescription('🎉 **Selamat! Kamu sudah memenuhi syarat verifikasi komunitas.**\n-# Hasil pengecekan otomatis via Roblox Open Cloud')
    .addFields(
      ...identityFields({ robloxUsername, displayName, userId }),
      dividerField(),
      { name: '📅 Bergabung Sejak', value: `<t:${joinEpoch}:F>\n<t:${joinEpoch}:R>`, inline: false },
      { name: 'Ready For Payout', value: '✅ Aktif', inline: true },
      { name: 'Verified Community', value: '✅ Aktif', inline: true }
    )
    .setThumbnail(avatarUrl || null);
}

function buildUserNotFoundEmbed(inputUsername, { botAvatarUrl } = {}) {
  return new EmbedBuilder()
    .setColor(COLOR_RED)
    .setTitle('🔴 Username Roblox Tidak Ditemukan')
    .setDescription(`Tidak ada akun Roblox dengan username \`${inputUsername}\`. Cek kembali ejaan username kamu.`)
    .setFooter({ text: FOOTER_TEXT, iconURL: botAvatarUrl || undefined });
}

function buildErrorEmbed({ botAvatarUrl } = {}) {
  return new EmbedBuilder()
    .setColor(COLOR_RED)
    .setTitle('⚠️ Terjadi Gangguan')
    .setDescription(
      'Bot gagal terhubung ke server Roblox setelah beberapa kali percobaan. ' +
      'Ini biasanya masalah sementara di sisi Roblox — silakan coba lagi dalam beberapa saat.'
    )
    .setFooter({ text: FOOTER_TEXT, iconURL: botAvatarUrl || undefined });
}

module.exports = {
  buildNotJoinedEmbed,
  buildUnverifiedEmbed,
  buildVerifiedEmbed,
  buildUserNotFoundEmbed,
  buildErrorEmbed,
};
