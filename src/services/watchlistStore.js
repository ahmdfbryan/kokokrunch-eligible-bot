const fs = require('fs');
const path = require('path');

// Menyimpan daftar user yang statusnya masih "Eligible Unverification",
// supaya scheduler bisa mengecek ulang mereka nanti dan kirim notif begitu
// sudah lolos 14 hari, tanpa perlu re-run manual dari sisi user.
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'watchlist.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAll() {
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('[Watchlist] Gagal membaca data/watchlist.json:', err);
    return [];
  }
}

function writeAll(entries) {
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_PATH, JSON.stringify(entries, null, 2));
  } catch (err) {
    console.error('[Watchlist] Gagal menyimpan data/watchlist.json:', err);
  }
}

function listWatchlist() {
  return readAll();
}

function upsertEntry(entry) {
  const entries = readAll();
  const idx = entries.findIndex((e) => String(e.robloxUserId) === String(entry.robloxUserId));
  if (idx >= 0) {
    entries[idx] = { ...entries[idx], ...entry };
  } else {
    entries.push(entry);
  }
  writeAll(entries);
}

function removeEntry(robloxUserId) {
  const entries = readAll().filter((e) => String(e.robloxUserId) !== String(robloxUserId));
  writeAll(entries);
}

/**
 * Sinkronkan watchlist berdasarkan hasil satu kali pengecekan eligibility.
 * - status "unverified" -> disimpan/diperbarui di watchlist.
 * - status lain (verified / not_joined) -> dihapus dari watchlist kalau ada
 *   (misal user sempat unverified, lalu dicek ulang manual dan ternyata sudah lolos).
 */
function syncFromResult(result, { channelId, discordUserId } = {}) {
  if (!result) return;

  if (result.status === 'unverified') {
    upsertEntry({
      robloxUserId: result.robloxUserId,
      robloxUsername: result.robloxUsername,
      displayName: result.displayName,
      joinDate: result.joinDate.toISOString(),
      eligibleDays: result.eligibleDays,
      channelId,
      discordUserId: discordUserId || null,
    });
  } else {
    removeEntry(result.robloxUserId);
  }
}

module.exports = { listWatchlist, upsertEntry, removeEntry, syncFromResult };
