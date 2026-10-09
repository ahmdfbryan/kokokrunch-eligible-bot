const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store-panels.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** Baca daftar semua panel Store yang pernah dikirim (bisa lebih dari 1 channel). */
function getStorePanels() {
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((p) => p?.channelId && p?.messageId);
  } catch (err) {
    console.error('[StorePanel] Gagal membaca data/store-panels.json:', err);
    return [];
  }
}

function writeStorePanels(panels) {
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_PATH, JSON.stringify(panels, null, 2));
  } catch (err) {
    console.error('[StorePanel] Gagal menyimpan data/store-panels.json:', err);
  }
}

/** Simpan referensi panel baru (atau timpa referensi lama di channel yang sama). */
function addStorePanel({ channelId, messageId }) {
  const panels = getStorePanels().filter((p) => p.channelId !== channelId);
  panels.push({ channelId, messageId });
  writeStorePanels(panels);
}

/** Hapus referensi panel (dipakai saat panel tidak ditemukan lagi / sudah dihapus). */
function removeStorePanel(channelId) {
  const panels = getStorePanels().filter((p) => p.channelId !== channelId);
  writeStorePanels(panels);
}

module.exports = { getStorePanels, addStorePanel, removeStorePanel };
