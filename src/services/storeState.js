const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store-state.json');

function readState() {
  if (!fs.existsSync(STORE_PATH)) return { open: true };
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { open: true };
  }
}

function writeState(state) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2));
}

function isStoreOpen() {
  return readState().open !== false;
}

function setStoreOpen(open) {
  writeState({ open });
}

module.exports = { isStoreOpen, setStoreOpen };
