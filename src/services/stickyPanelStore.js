const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'sticky-panel.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStickyPanel() {
  try {
    if (!fs.existsSync(STORE_PATH)) return null;
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (!data?.channelId || !data?.messageId) return null;
    return data;
  } catch (err) {
    console.error('[StickyPanel] Gagal membaca data/sticky-panel.json:', err);
    return null;
  }
}

function writeStickyPanel({ channelId, messageId }) {
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_PATH, JSON.stringify({ channelId, messageId }, null, 2));
  } catch (err) {
    console.error('[StickyPanel] Gagal menyimpan data/sticky-panel.json:', err);
  }
}

function clearStickyPanel() {
  try {
    if (fs.existsSync(STORE_PATH)) fs.unlinkSync(STORE_PATH);
  } catch (err) {
    console.error('[StickyPanel] Gagal menghapus data/sticky-panel.json:', err);
  }
}

module.exports = { readStickyPanel, writeStickyPanel, clearStickyPanel };
