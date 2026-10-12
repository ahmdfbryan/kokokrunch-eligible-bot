const { ChannelType, PermissionFlagsBits, OverwriteType } = require('discord.js');
const config = require('../config');

// Batas Discord: maksimal 50 channel dalam 1 kategori.
const MAX_CHANNELS_PER_CATEGORY = 50;

// Antrian sederhana supaya pemilihan/pembuatan kategori + channel tidak balapan
// (misal 2 pembeli klik "Ya" bersamaan saat kategori tinggal sisa 1 slot).
let chain = Promise.resolve();
function runExclusive(fn) {
  const run = chain.then(fn);
  chain = run.catch(() => {});
  return run;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
 * Cari kategori untuk produk (nama persis "<baseName>", "<baseName> 2", "<baseName> 3", ...)
 * yang masih punya slot kosong (< 50 channel). Kalau semua penuh / belum ada,
 * otomatis buat kategori baru dengan nomor berikutnya.
 *
 * Panggil di dalam runExclusive() bersama pembuatan channel ticket-nya.
 */
async function getOrCreateCategory(guild, baseName) {
  const fetched = await guild.channels.fetch();
  const all = [...fetched.values()].filter(Boolean);

  const nameRegex = new RegExp(`^${escapeRegex(baseName)}(?: (\\d+))?$`, 'i');
  const categories = [];
  for (const channel of all) {
    if (channel.type !== ChannelType.GuildCategory) continue;
    const match = channel.name.match(nameRegex);
    if (!match) continue;
    categories.push({ channel, index: match[1] ? Number(match[1]) : 1 });
  }
  categories.sort((a, b) => a.index - b.index);

  for (const { channel } of categories) {
    const childCount = all.filter((c) => c.parentId === channel.id).length;
    if (childCount < MAX_CHANNELS_PER_CATEGORY) return channel;
  }

  const nextIndex = categories.length ? categories[categories.length - 1].index + 1 : 1;
  const name = nextIndex === 1 ? baseName : `${baseName} ${nextIndex}`;
  return guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    permissionOverwrites: buildCategoryOverwrites(guild),
  });
}

module.exports = { runExclusive, getOrCreateCategory, MAX_CHANNELS_PER_CATEGORY };
