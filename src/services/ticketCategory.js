const fs = require('fs');
const path = require('path');
const { ChannelType, PermissionFlagsBits, OverwriteType } = require('discord.js');
const config = require('../config');

// Batas Discord: maksimal 50 channel dalam 1 kategori.
const MAX_CHANNELS_PER_CATEGORY = 50;

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'ticket-categories.json');

// Antrian sederhana supaya pemilihan/pembuatan kategori + channel tidak balapan
// (misal 2 pembeli klik "Ya" bersamaan saat kategori tinggal sisa 1 slot).
let chain = Promise.resolve();
function runExclusive(fn) {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
}

// --- Penyimpanan ID kategori per produk (supaya kategori yang sudah dipakai
// tetap dikenali walaupun namanya diubah manual di Discord). ---
function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error('[Ticket] Gagal menyimpan data/ticket-categories.json:', err);
  }
}

/** Huruf kecil, buang emoji/simbol/spasi -> "🐾 Golden Pet │ 2" jadi "goldenpet2". */
function normalize(text) {
  return String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Kembalikan nomor urut kategori kalau namanya cocok dengan produk ("Golden Pet" = 1, "Golden Pet 2" = 2), selain itu null. */
function matchCategoryIndex(categoryName, baseName) {
  const n = normalize(categoryName);
  const b = normalize(baseName);
  if (!b || !n.startsWith(b)) return null;
  const rest = n.slice(b.length);
  if (rest === '') return 1;
  if (/^\d+$/.test(rest)) return Number(rest);
  return null;
}

function buildCategoryOverwrites(guild) {
  const overwrites = [
    { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: guild.client.user.id,
      type: OverwriteType.Member,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
    },
  ];
  if (config.storeStaffRoleId) {
    overwrites.push({
      id: config.storeStaffRoleId,
      type: OverwriteType.Role,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }
  return overwrites;
}

/**
 * Pilih kategori untuk ticket produk ini yang masih punya slot kosong (< 50 channel).
 * Urutan kandidat:
 *   1. Kategori lama dari TICKET_CATEGORY_ID (hanya kalau produk menandai useLegacyCategory)
 *   2. Kategori yang pernah dipakai bot untuk produk ini (tersimpan di data/ticket-categories.json)
 *   3. Kategori yang namanya cocok ("Golden Pet", "Golden Pet 2", ... -- emoji/simbol diabaikan)
 * Kalau semuanya penuh / belum ada, otomatis buat kategori baru.
 *
 * Panggil di dalam runExclusive() bersama pembuatan channel ticket-nya.
 */
async function getOrCreateCategory(guild, { productKey, baseName, legacyCategoryId = null }) {
  const fetched = await guild.channels.fetch();
  const all = [...fetched.values()].filter(Boolean);
  const byId = new Map(all.map((c) => [c.id, c]));

  const nameMatched = [];
  for (const channel of all) {
    if (channel.type !== ChannelType.GuildCategory) continue;
    const index = matchCategoryIndex(channel.name, baseName);
    if (index !== null) nameMatched.push({ channel, index });
  }
  nameMatched.sort((a, b) => a.index - b.index);

  const store = readStore();
  const candidates = [];
  const addCandidate = (channel) => {
    if (channel && channel.type === ChannelType.GuildCategory && !candidates.some((c) => c.id === channel.id)) {
      candidates.push(channel);
    }
  };
  if (legacyCategoryId) addCandidate(byId.get(legacyCategoryId));
  for (const id of store[productKey] || []) addCandidate(byId.get(id));
  for (const { channel } of nameMatched) addCandidate(channel);

  const countChildren = (category) => all.filter((c) => c.parentId === category.id).length;

  let chosen = null;
  for (const category of candidates) {
    if (countChildren(category) < MAX_CHANNELS_PER_CATEGORY) {
      chosen = category;
      break;
    }
  }

  if (!chosen) {
    const nextIndex = nameMatched.length ? nameMatched[nameMatched.length - 1].index + 1 : 1;
    const name = nextIndex === 1 ? baseName : `${baseName} ${nextIndex}`;
    chosen = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: buildCategoryOverwrites(guild),
    });
    addCandidate(chosen);
    console.log(`[Ticket] Semua kategori "${baseName}" penuh/belum ada -> membuat kategori baru "${name}"`);
  }

  store[productKey] = candidates.map((c) => c.id);
  writeStore(store);

  console.log(
    `[Ticket] Kategori dipilih untuk ${productKey}: "${chosen.name}" ` +
    `(${countChildren(chosen)}/${MAX_CHANNELS_PER_CATEGORY} channel, ${candidates.length} kategori dikenali)`
  );
  return chosen;
}

module.exports = { runExclusive, getOrCreateCategory, matchCategoryIndex, MAX_CHANNELS_PER_CATEGORY };
