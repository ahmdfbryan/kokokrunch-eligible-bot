const { EmbedBuilder } = require('discord.js');
const { formatRupiah } = require('../data/products');

const BRAND_COLOR = 0xd4af37; // emas -- kesan "premium"
const COLOR_SUCCESS = 0x2ecc71;
const COLOR_DANGER = 0xe74c3c;
const COLOR_INFO = 0x5865f2;
const COLOR_REFUND = 0xf39c12;

/** Embed utama panel store -- info toko & tata cara pembelian. */
function buildStorePanelEmbed({ guildIconUrl, storeOpen }) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('🛒 KokoKrunch Store')
    .setDescription(
      'Selamat datang di **KokoKrunch Store**! ✨\n' +
      'Belanja item eksklusif untuk akun Roblox kamu dengan aman & cepat.\n\n' +
      '**📋 Tata Cara Pembelian**\n' +
      '`1.` Pilih produk yang ingin dibeli di dropdown di bawah ini\n' +
      '`2.` Masukkan username Roblox kamu saat diminta\n' +
      '`3.` Konfirmasi data akun yang tampil\n' +
      '`4.` Ticket pembelian akan dibuat otomatis beserta QRIS pembayaran\n' +
      '`5.` Lakukan pembayaran sesuai **nominal persis** yang tertera (termasuk kode unik)\n' +
      '`6.` Tunggu staff kami memverifikasi & memproses pesananmu\n\n' +
      (storeOpen
        ? '🟢 **Status Toko: BUKA** — silakan pilih produk di bawah.'
        : '🔴 **Status Toko: TUTUP** — mohon maaf, toko sedang tidak menerima pesanan saat ini.')
    )
    .setFooter({ text: 'KokoKrunch Studios • Store System' })
    .setTimestamp();

  if (guildIconUrl) {
    embed.setAuthor({ name: 'KokoKrunch Studios', iconURL: guildIconUrl });
    embed.setThumbnail(guildIconUrl);
  }

  return embed;
}

/** Embed konfirmasi akun Roblox sebelum ticket dibuat. */
function buildRobloxConfirmEmbed({ username, displayName, avatarUrl, productLabel }) {
  const embed = new EmbedBuilder()
    .setColor(COLOR_INFO)
    .setTitle('🔍 Confirm Your Roblox Account')
    .setDescription(
      'Is this really your Roblox account?\n\n' +
      `> Untuk pembelian **${productLabel}**.`
    )
    .addFields(
      { name: '👤 Username', value: `\`${username}\``, inline: true },
      { name: '🪪 Display Name', value: `\`${displayName || username}\``, inline: true }
    )
    .setFooter({ text: 'KokoKrunch Studios • Store System' });

  if (avatarUrl) embed.setThumbnail(avatarUrl);
  return embed;
}

/** Embed utama di dalam channel ticket -- rincian pesanan + instruksi bayar. */
function buildTicketEmbed({ ticket, guildIconUrl }) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('🧾 Rincian Pesanan')
    .setDescription(
      `Terima kasih sudah berbelanja di **KokoKrunch Store**! 🎉\n` +
      `Silakan lakukan pembayaran sesuai nominal **persis** di bawah ini via QRIS.`
    )
    .addFields(
      { name: '🆔 Ticket ID', value: `\`${ticket.ticketId}\``, inline: true },
      { name: '📦 Produk', value: `\`${ticket.productLabel}\``, inline: true },
      { name: '👤 Akun Roblox', value: `\`${ticket.robloxUsername}\``, inline: true },
      { name: '💵 Harga Produk', value: formatRupiah(ticket.price), inline: true },
      { name: '🔢 Kode Unik', value: `+${ticket.uniqueCode}`, inline: true },
      { name: '💳 Total Bayar', value: `**${formatRupiah(ticket.total)}**`, inline: true }
    )
    .addFields({
      name: '⚠️ Penting',
      value:
        `Transfer harus **PERSIS ${formatRupiah(ticket.total)}** (termasuk kode unik) ` +
        'agar pesanan otomatis dapat kami cocokkan. Setelah membayar, mohon tunggu staff kami memverifikasi.',
    })
    .setFooter({ text: 'KokoKrunch Studios • Dipercaya & Terverifikasi' })
    .setTimestamp();

  if (guildIconUrl) embed.setAuthor({ name: 'KokoKrunch Studios', iconURL: guildIconUrl });

  return embed;
}

const CLOSE_STATUS_META = {
  completed: {
    label: 'Transaksi Berhasil Diselesaikan',
    emoji: '🎉',
    color: COLOR_SUCCESS,
    statusText: 'COMPLETED',
    statusEmoji: '🟢',
    description: '✨ Pesanan telah diproses dan produk sudah **berhasil terkirim**. Terima kasih sudah berbelanja bersama kami!',
  },
  cancelled: {
    label: 'Transaksi Dibatalkan',
    emoji: '🚫',
    color: COLOR_DANGER,
    statusText: 'CANCELLED',
    statusEmoji: '🔴',
    description: '❌ Pesanan ini telah **dibatalkan**. Jika ada pertanyaan silakan hubungi staff kami.',
  },
  refunded: {
    label: 'Transaksi Direfund',
    emoji: '💸',
    color: COLOR_REFUND,
    statusText: 'REFUNDED',
    statusEmoji: '🟠',
    description: '💰 Pesanan ini telah **direfund** ke pembeli. Terima kasih atas pengertiannya.',
  },
};

/** Embed status order yang dikirim ke channel log setelah ticket ditutup. */
function buildOrderStatusEmbed({ ticket, closeStatus, note, closedByTag, guildIconUrl }) {
  const meta = CLOSE_STATUS_META[closeStatus];

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setAuthor({ name: `KokoKrunch Studios • Order ${ticket.productLabel}`, iconURL: guildIconUrl || undefined })
    .setTitle(`${meta.emoji} ${meta.label}`)
    .setDescription(meta.description)
    .addFields(
      { name: '🆔 Ticket ID', value: `\`${ticket.ticketId}\``, inline: true },
      { name: '🛒 Pembeli', value: `<@${ticket.buyerId}>`, inline: true },
      { name: '👤 Akun Roblox', value: `\`${ticket.robloxUsername}\``, inline: true },
      { name: '📌 Status', value: `${meta.statusEmoji} ${meta.statusText}`, inline: true },
      { name: '📦 Produk', value: ticket.productLabel, inline: true },
      { name: '💳 Total Dibayar', value: formatRupiah(ticket.total), inline: true },
      { name: '💰 Metode Bayar', value: 'QRIS', inline: true },
      { name: '📝 Catatan Admin', value: note && note.trim() ? note.trim() : '-' }
    )
    .setFooter({ text: `KokoKrunch Studios • Diproses oleh ${closedByTag}` })
    .setTimestamp();

  return embed;
}

/** Embed yang dikirim via DM ke pembeli setelah ticket berhasil dibuat. */
function buildTicketCreatedDmEmbed({ ticket, channelId, guildIconUrl }) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('🎫 Ticket Order Berhasil Dibuat')
    .setDescription(
      'Ticket order kamu di **KokoKrunch Studios** sudah berhasil dibuat.\n\n' +
      `Silakan lanjutkan ke channel ticket kamu untuk menyelesaikan pembayaran: <#${channelId}>`
    )
    .addFields(
      { name: '📦 Produk', value: ticket.productLabel, inline: true },
      { name: '🆔 Ticket ID', value: `\`${ticket.ticketId}\``, inline: true }
    )
    .setFooter({ text: 'KokoKrunch Studios • Store System' })
    .setTimestamp();

  if (guildIconUrl) embed.setThumbnail(guildIconUrl);

  return embed;
}

module.exports = {
  buildStorePanelEmbed,
  buildRobloxConfirmEmbed,
  buildTicketEmbed,
  buildOrderStatusEmbed,
  buildTicketCreatedDmEmbed,
  CLOSE_STATUS_META,
};
