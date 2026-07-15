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
};

if (Number.isNaN(config.eligibleDays) || config.eligibleDays <= 0) {
  throw new Error('[CONFIG ERROR] ELIGIBLE_DAYS harus berupa angka positif.');
}

module.exports = config;
