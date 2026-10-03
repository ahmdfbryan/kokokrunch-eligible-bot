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

function buildGenderPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('👤 GENDER SELECTION')
    .setDescription(
      'Silakan klik tombol di bawah ini untuk mengambil role sesuai gender kamu.\n\n' +
      '*Klik kembali untuk menghapus role yang sudah dimiliki.*\n\n' +
      '**KokoKrunch Studios**'
    );

  const row = new ActionRowBuilder();
  if (config.roleMaleId) {
    row.addComponents(
      new ButtonBuilder().setCustomId(TOGGLE_MALE_BUTTON_ID).setLabel('Male').setEmoji('♂️').setStyle(ButtonStyle.Primary)
    );
  }
  if (config.roleFemaleId) {
    row.addComponents(
      new ButtonBuilder().setCustomId(TOGGLE_FEMALE_BUTTON_ID).setLabel('Female').setEmoji('♀️').setStyle(ButtonStyle.Danger)
    );
  }

  return { embeds: [embed], components: row.components.length ? [row] : [] };
}

function buildGamePayload() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎮 GAME SELECTION')
    .setDescription(
      'Silakan klik tombol di bawah ini untuk mengambil role.\n\n' +
      '*Klik kembali untuk menghapus role yang sudah dimiliki.*\n\n' +
      '**KokoKrunch Studios**'
    );

  const row = new ActionRowBuilder();
  if (config.roleGameRobloxId) {
    row.addComponents(new ButtonBuilder().setCustomId(TOGGLE_GAME_ROBLOX_BUTTON_ID).setLabel('ROBLOX').setStyle(ButtonStyle.Secondary));
  }
  if (config.roleGameFreefireId) {
    row.addComponents(new ButtonBuilder().setCustomId(TOGGLE_GAME_FREEFIRE_BUTTON_ID).setLabel('Free Fire').setStyle(ButtonStyle.Secondary));
  }
  if (config.roleGamePubgId) {
    row.addComponents(new ButtonBuilder().setCustomId(TOGGLE_GAME_PUBG_BUTTON_ID).setLabel('PUBG').setStyle(ButtonStyle.Secondary));
  }
  if (config.roleGameMlbbId) {
    row.addComponents(new ButtonBuilder().setCustomId(TOGGLE_GAME_MLBB_BUTTON_ID).setLabel('Mobile Legends').setStyle(ButtonStyle.Secondary));
  }

  return { embeds: [embed], components: row.components.length ? [row] : [] };
}

/** Dipanggil sekali saat bot ready. Kirim 2 pesan terpisah ke ROLE_PANEL_CHANNEL_ID, HANYA kalau belum pernah dikirim. */
async function ensureRolePanelsPosted(client) {
  if (!config.rolePanelChannelId) return; // fitur tidak diaktifkan
  if (hasBeenSent()) return; // sudah pernah dikirim sebelumnya, jangan dobel

  try {
    const channel = await client.channels.fetch(config.rolePanelChannelId);
    if (!channel || !channel.isTextBased()) {
      console.error(`[RolePanel] Channel ${config.rolePanelChannelId} tidak ditemukan/bukan text channel.`);
      return;
    }

    const genderMessage = await channel.send(buildGenderPayload());
    const gameMessage = await channel.send(buildGamePayload());

    markAsSent({
      channelId: config.rolePanelChannelId,
      genderMessageId: genderMessage.id,
      gameMessageId: gameMessage.id,
    });

    console.log('[RolePanel] Panel Gender & Game berhasil dikirim ke channel.');
  } catch (err) {
    console.error('[RolePanel] Gagal mengirim panel Gender/Game:', err);
  }
}

module.exports = {
  ROLE_ID_BY_BUTTON,
  ensureRolePanelsPosted,
};
