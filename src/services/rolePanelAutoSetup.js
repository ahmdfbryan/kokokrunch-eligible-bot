const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');

// --- Penyimpanan status "sudah terkirim" -- supaya panel ini cuma dikirim ---
// --- SEKALI saja (tidak dikirim ulang setiap kali bot di-restart). ---
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'role-panel-sent.json');

function hasBeenSent() {
  return fs.existsSync(STORE_PATH);
}

function markAsSent(info) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(info, null, 2));
}

// --- custom_id tiap tombol -> dipetakan ke role ID dari .env ---
const TOGGLE_MALE_BUTTON_ID = 'role_toggle_male';
const TOGGLE_FEMALE_BUTTON_ID = 'role_toggle_female';
const TOGGLE_GAME_ROBLOX_BUTTON_ID = 'role_toggle_game_roblox';
const TOGGLE_GAME_FREEFIRE_BUTTON_ID = 'role_toggle_game_freefire';
const TOGGLE_GAME_PUBG_BUTTON_ID = 'role_toggle_game_pubg';
const TOGGLE_GAME_MLBB_BUTTON_ID = 'role_toggle_game_mlbb';

// Hanya berisi entry yang role ID-nya memang diisi di .env -- kalau kosong,
// tombolnya otomatis tidak dibuat sama sekali (daripada tombol error kalau diklik).
const ROLE_ID_BY_BUTTON = {};
if (config.roleMaleId) ROLE_ID_BY_BUTTON[TOGGLE_MALE_BUTTON_ID] = config.roleMaleId;
if (config.roleFemaleId) ROLE_ID_BY_BUTTON[TOGGLE_FEMALE_BUTTON_ID] = config.roleFemaleId;
if (config.roleGameRobloxId) ROLE_ID_BY_BUTTON[TOGGLE_GAME_ROBLOX_BUTTON_ID] = config.roleGameRobloxId;
if (config.roleGameFreefireId) ROLE_ID_BY_BUTTON[TOGGLE_GAME_FREEFIRE_BUTTON_ID] = config.roleGameFreefireId;
if (config.roleGamePubgId) ROLE_ID_BY_BUTTON[TOGGLE_GAME_PUBG_BUTTON_ID] = config.roleGamePubgId;
if (config.roleGameMlbbId) ROLE_ID_BY_BUTTON[TOGGLE_GAME_MLBB_BUTTON_ID] = config.roleGameMlbbId;

// Nama tampilan tiap tombol -- dipakai untuk menyebut nama role di embed feedback.
const ROLE_LABEL_BY_BUTTON = {
  [TOGGLE_MALE_BUTTON_ID]: 'Male',
  [TOGGLE_FEMALE_BUTTON_ID]: 'Female',
  [TOGGLE_GAME_ROBLOX_BUTTON_ID]: 'ROBLOX',
  [TOGGLE_GAME_MLBB_BUTTON_ID]: 'Mobile Legends',
  [TOGGLE_GAME_PUBG_BUTTON_ID]: 'PUBG',
  [TOGGLE_GAME_FREEFIRE_BUTTON_ID]: 'Free Fire',
};

const PANEL_COLOR = 0x3b1f1f; // nuansa maroon gelap, sesuai referensi
const FOOTER_NOTE_TEXT =
  '⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n\n' +
  '*Klik kembali untuk menghapus role yang sudah dimiliki.*\n\n' +
  '**KokoKrunch Studios**';

function buildFooterNoteEmbed() {
  return new EmbedBuilder().setColor(PANEL_COLOR).setDescription(FOOTER_NOTE_TEXT);
}

// --- Gender Selection ---
function buildGenderPrimaryPayload() {
  const embed = new EmbedBuilder()
    .setColor(PANEL_COLOR)
    .setTitle('🚻 GENDER SELECTION')
    .setDescription('Silakan klik tombol di bawah ini untuk mengambil role.');

  const row = new ActionRowBuilder();
  if (config.roleMaleId) {
    row.addComponents(new ButtonBuilder().setCustomId(TOGGLE_MALE_BUTTON_ID).setLabel('Male').setStyle(ButtonStyle.Secondary));
  }
  if (config.roleFemaleId) {
    row.addComponents(new ButtonBuilder().setCustomId(TOGGLE_FEMALE_BUTTON_ID).setLabel('Female').setStyle(ButtonStyle.Secondary));
  }

  return { embeds: [embed], components: row.components.length ? [row] : [] };
}

// --- Game Selection ---
function buildGamePrimaryPayload() {
  const embed = new EmbedBuilder()
    .setColor(PANEL_COLOR)
    .setTitle('🧩 GAME SELECTION')
    .setDescription('Silakan klik tombol di bawah ini untuk mengambil role.');

  const row = new ActionRowBuilder();
  if (config.roleGameRobloxId) {
    row.addComponents(new ButtonBuilder().setCustomId(TOGGLE_GAME_ROBLOX_BUTTON_ID).setLabel('ROBLOX').setStyle(ButtonStyle.Secondary));
  }
  if (config.roleGameMlbbId) {
    row.addComponents(new ButtonBuilder().setCustomId(TOGGLE_GAME_MLBB_BUTTON_ID).setLabel('Mobile Legends').setStyle(ButtonStyle.Secondary));
  }
  if (config.roleGamePubgId) {
    row.addComponents(new ButtonBuilder().setCustomId(TOGGLE_GAME_PUBG_BUTTON_ID).setLabel('PUBG').setStyle(ButtonStyle.Secondary));
  }
  if (config.roleGameFreefireId) {
    row.addComponents(new ButtonBuilder().setCustomId(TOGGLE_GAME_FREEFIRE_BUTTON_ID).setLabel('Free Fire').setStyle(ButtonStyle.Secondary));
  }

  return { embeds: [embed], components: row.components.length ? [row] : [] };
}

// --- Embed "premium" untuk feedback saat tombol Gender/Game diklik ---
// Thumbnail (logo KokoKrunch Studios) ditaruh di pojok kanan embed via setThumbnail.
const ROLE_ADDED_COLOR = 0x2ecc71; // hijau emerald
const ROLE_REMOVED_COLOR = 0xe74c3c; // merah

function buildRoleToggleEmbed({ added, guildIconUrl, roleName }) {
  const roleText = roleName ? `**${roleName}**` : 'role tersebut';

  const embed = new EmbedBuilder()
    .setColor(added ? ROLE_ADDED_COLOR : ROLE_REMOVED_COLOR)
    .setAuthor({ name: '✨ KokoKrunch Studios', iconURL: guildIconUrl || undefined })
    .setTitle(added ? '🎉 Role Berhasil Diaktifkan' : '👋 Role Berhasil Dinonaktifkan')
    .setDescription(
      added
        ? `Selamat! Role ${roleText} kini resmi melekat di profil Discord kamu.\n\n` +
          `> Klik tombol yang sama kapan saja untuk melepasnya.`
        : `Role ${roleText} telah dilepas dari profil Discord kamu.\n\n` +
          `> Klik tombol yang sama kapan saja untuk mengaktifkannya kembali.`
    )
    .setFooter({ text: 'KokoKrunch Studios • Role System', iconURL: guildIconUrl || undefined })
    .setTimestamp();

  if (guildIconUrl) embed.setThumbnail(guildIconUrl);

  return embed;
}

/**
 * Dipanggil sekali saat bot ready. Kirim panel Gender lalu panel Game ke
 * ROLE_PANEL_CHANNEL_ID, HANYA kalau belum pernah dikirim. Tiap panel terdiri
 * dari 2 pesan beruntun (judul+tombol, lalu catatan+footer) supaya tampil
 * menyatu sebagai 1 kartu, dengan tombol "di tengah", sesuai referensi.
 */
async function ensureRolePanelsPosted(client) {
  if (!config.rolePanelChannelId) return; // fitur tidak diaktifkan
  if (hasBeenSent()) return; // sudah pernah dikirim sebelumnya, jangan dobel

  try {
    const channel = await client.channels.fetch(config.rolePanelChannelId);
    if (!channel || !channel.isTextBased()) {
      console.error(`[RolePanel] Channel ${config.rolePanelChannelId} tidak ditemukan/bukan text channel.`);
      return;
    }

    const genderMain = await channel.send(buildGenderPrimaryPayload());
    const genderFooter = await channel.send({ embeds: [buildFooterNoteEmbed()] });
    const gameMain = await channel.send(buildGamePrimaryPayload());
    const gameFooter = await channel.send({ embeds: [buildFooterNoteEmbed()] });

    markAsSent({
      channelId: config.rolePanelChannelId,
      genderMainId: genderMain.id,
      genderFooterId: genderFooter.id,
      gameMainId: gameMain.id,
      gameFooterId: gameFooter.id,
    });

    console.log('[RolePanel] Panel Gender & Game berhasil dikirim ke channel.');
  } catch (err) {
    console.error('[RolePanel] Gagal mengirim panel Gender/Game:', err);
  }
}

module.exports = {
  ROLE_ID_BY_BUTTON,
  ROLE_LABEL_BY_BUTTON,
  ensureRolePanelsPosted,
  buildRoleToggleEmbed,
};
