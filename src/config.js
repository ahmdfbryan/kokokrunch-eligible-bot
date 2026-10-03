require('dotenv').config();

function required(name) {
  const val = process.env[name];
  if (!val || val.trim() === '') {
    throw new Error(
      `[CONFIG ERROR] Environment variable "${name}" wajib diisi di file .env. ` +
      `Cek kembali file .env kamu (lihat .env.example sebagai contoh).`
    );
  }
  return val.trim();
}

const config = {
  discordToken: required('DISCORD_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordGuildId: process.env.DISCORD_GUILD_ID?.trim() || null,

  robloxApiKey: required('ROBLOX_API_KEY'),
  robloxGroupId: required('ROBLOX_GROUP_ID'),

  eligibleDays: Number(process.env.ELIGIBLE_DAYS || 14),

  // Fitur panel role Gender + Game (otomatis terkirim sekali ke channel ini saat bot nyala).
  // Semua opsional -- kalau ROLE_PANEL_CHANNEL_ID kosong, fitur ini otomatis dilewati.
  rolePanelChannelId: process.env.ROLE_PANEL_CHANNEL_ID?.trim() || null,
  roleMaleId: process.env.ROLE_MALE_ID?.trim() || null,
  roleFemaleId: process.env.ROLE_FEMALE_ID?.trim() || null,
  roleGameRobloxId: process.env.ROLE_GAME_ROBLOX_ID?.trim() || null,
  roleGameFreefireId: process.env.ROLE_GAME_FREEFIRE_ID?.trim() || null,
  roleGamePubgId: process.env.ROLE_GAME_PUBG_ID?.trim() || null,
  roleGameMlbbId: process.env.ROLE_GAME_MLBB_ID?.trim() || null,
};

if (Number.isNaN(config.eligibleDays) || config.eligibleDays <= 0) {
  throw new Error('[CONFIG ERROR] ELIGIBLE_DAYS harus berupa angka positif.');
}

module.exports = config;
