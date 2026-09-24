const roblox = require('../roblox');
const { buildVerifiedEmbed } = require('../embeds');
const { listWatchlist, removeEntry } = require('./watchlistStore');

// Cek daftar pantauan tiap 1 jam. Kita TIDAK panggil API Roblox untuk semua
// entry setiap kali -- waktu "eligibleAt" sudah bisa dihitung langsung dari
// joinDate yang sudah kita simpan, jadi entry yang belum waktunya dilewati
// tanpa request apa pun. API baru dipanggil sekali untuk konfirmasi terakhir
// begitu waktunya sudah lewat (jaga-jaga kalau user keluar dari komunitas).
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 jam

async function processEntry(client, entry) {
  const eligibleAtMs = new Date(entry.joinDate).getTime() + entry.eligibleDays * 24 * 60 * 60 * 1000;
  if (Date.now() < eligibleAtMs) return; // belum waktunya, skip dulu

  try {
    const membership = await roblox.checkMembership(entry.robloxUserId);

    if (!membership.isMember) {
      console.log(`[Watchlist] ${entry.robloxUsername} sudah tidak terdeteksi jadi member, dihapus dari pantauan.`);
      removeEntry(entry.robloxUserId);
      return;
    }

    const daysSinceJoin = (Date.now() - membership.joinDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceJoin < entry.eligibleDays) return; // ternyata belum genap (edge case), coba lagi jam berikutnya

    const channel = await client.channels.fetch(entry.channelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      const avatarUrl = await roblox.getAvatarUrl(entry.robloxUserId).catch(() => null);
      const botAvatarUrl = client.user.displayAvatarURL({ size: 128 });
      const guildIconUrl = channel.guild?.iconURL({ size: 128 }) || null;

      const embed = buildVerifiedEmbed({
        robloxUsername: entry.robloxUsername,
        displayName: entry.displayName,
        userId: entry.robloxUserId,
        avatarUrl,
        joinDate: membership.joinDate,
        guildIconUrl,
        botAvatarUrl,
      });

      const mention = entry.discordUserId ? `<@${entry.discordUserId}> ` : '';
      await channel.send({
        content: `${mention}Selamat, akun Roblox kamu sekarang sudah eligible untuk order robux komunitas! 🎉`,
        embeds: [embed],
      });
    } else {
      console.warn(`[Watchlist] Channel ${entry.channelId} tidak ditemukan/tidak bisa dikirimi pesan, notif dilewati.`);
    }

    removeEntry(entry.robloxUserId);
  } catch (err) {
    console.error(`[Watchlist] Gagal proses ulang untuk "${entry.robloxUsername}":`, err.message);
    // Tidak dihapus dari daftar -- akan dicoba lagi di siklus berikutnya (1 jam lagi).
  }
}

function runCheckCycle(client) {
  const entries = listWatchlist();
  entries.forEach((entry) => {
    processEntry(client, entry).catch((err) =>
      console.error('[Watchlist] Unhandled error saat proses entry:', err)
    );
  });
}

function startWatchlistScheduler(client) {
  runCheckCycle(client); // langsung cek begitu bot nyala/restart, tidak perlu nunggu 1 jam pertama
  setInterval(() => runCheckCycle(client), CHECK_INTERVAL_MS);

  console.log(`[Watchlist] Scheduler aktif, cek ulang setiap ${CHECK_INTERVAL_MS / 60000} menit.`);
}

module.exports = { startWatchlistScheduler, processEntry };
