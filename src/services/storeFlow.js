const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
  OverwriteType,
  EmbedBuilder,
} = require('discord.js');
const config = require('../config');
const roblox = require('../roblox');
const { getProductById, formatRupiah } = require('../data/products');
const { isStoreOpen } = require('./storeState');
const ticketStore = require('./ticketStore');
const { generateDynamicQrisImage } = require('./qris');
const { runExclusive, getOrCreateCategory } = require('./ticketCategory');
const {
  buildRobloxConfirmEmbed,
  buildTicketEmbed,
  buildOrderStatusEmbed,
  buildTicketCreatedDmEmbed,
  buildProductDeliveredDmEmbed,
  buildPaymentClaimedEmbed,
  buildFundsReceivedEmbed,
  buildPaymentDeadlineEmbed,
  PAYMENT_STATUS_FIELD_NAME,
} = require('../embeds/storeEmbeds');

const USERNAME_MODAL_PREFIX = 'store_username_modal_';
const USERNAME_INPUT_ID = 'roblox_username_input';
const CONFIRM_YES_ID = 'store_confirm_yes';
const CONFIRM_NO_ID = 'store_confirm_no';
const CLOSE_TICKET_BUTTON_ID = 'store_close_ticket';
const QRIS_ATTACHMENT_URL = 'attachment://qris.png';
const CONFIRM_PAYMENT_BUTTON_ID = 'store_confirm_payment';
const CLOSE_SELECT_ID = 'store_close_select';
const CLOSE_MODAL_PREFIX = 'store_close_modal_';
const CLOSE_NOTE_INPUT_ID = 'close_note_input';

const CLOSE_STATUS_OPTIONS = [
  { label: 'Completed - Produk berhasil dikirim', value: 'completed', emoji: '✅' },
  { label: 'Cancelled - Dibatalkan', value: 'cancelled', emoji: '🚫' },
  { label: 'Refund - Dana dikembalikan', value: 'refunded', emoji: '💸' },
];

const PENDING_TTL_MS = 10 * 60 * 1000; // 10 menit
// key: buyerId -> { productId, username, displayName, userId, avatarUrl, createdAt }
const pendingConfirmations = new Map();

function prunePending() {
  const now = Date.now();
  for (const [key, val] of pendingConfirmations.entries()) {
    if (now - val.createdAt > PENDING_TTL_MS) pendingConfirmations.delete(key);
  }
}

function isStaffOrOwner(member, guild) {
  if (guild.ownerId === member.id) return true;
  if (config.storeStaffRoleId && member.roles.cache.has(config.storeStaffRoleId)) return true;
  return false;
}

/**
 * Cek ticket aktif milik buyer, tapi validasi dulu channel-nya masih ada.
 * Kalau channel ticket ternyata sudah dihapus manual (di luar bot, misal
 * dihapus langsung dari Discord), otomatis tutup record ticket itu supaya
 * buyer tidak nyangkut dianggap masih punya ticket aktif.
 */
async function validateOpenTicket(guild, ticket) {
  if (!ticket) return null;

  try {
    const channel = await guild.channels.fetch(ticket.channelId);
    if (channel) return ticket;
  } catch {
    // channel tidak ditemukan -> lanjut ke bawah untuk auto-close
  }

  ticketStore.forceCloseIfOrphaned(ticket.channelId);
  return null;
}

async function getActiveTicketOrHeal(guild, buyerId) {
  return validateOpenTicket(guild, ticketStore.getOpenTicketByBuyer(buyerId));
}

/** Sama seperti di atas, tapi berdasarkan akun Roblox (1 username Roblox = 1 ticket aktif). */
async function getActiveTicketByRobloxOrHeal(guild, { robloxUserId, robloxUsername }) {
  for (let i = 0; i < 5; i++) {
    const ticket = ticketStore.getOpenTicketByRobloxUser({ robloxUserId, robloxUsername });
    if (!ticket) return null;
    const valid = await validateOpenTicket(guild, ticket);
    if (valid) return valid;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. Pilih produk di dropdown
// ---------------------------------------------------------------------------
async function handleProductSelect(interaction) {
  const productId = interaction.values[0];
  const product = getProductById(productId);

  if (!product) {
    await interaction.reply({ content: '⚠️ Produk tidak dikenali.', ephemeral: true });
    return;
  }

  if (!product.enabled) {
    await interaction.reply({
      content: `🔒 **${product.label}** belum tersedia saat ini. Nantikan kabar selanjutnya ya!`,
      ephemeral: true,
    });
    return;
  }

  if (!isStoreOpen()) {
    await interaction.reply({
      content: '🔴 Toko sedang **tutup**. Silakan coba lagi nanti.',
      ephemeral: true,
    });
    return;
  }

  const existingTicket = await getActiveTicketOrHeal(interaction.guild, interaction.user.id);
  if (existingTicket) {
    await interaction.reply({
      content: `⚠️ Kamu masih punya ticket aktif: <#${existingTicket.channelId}>. Selesaikan ticket tersebut dulu sebelum membuat yang baru.`,
      ephemeral: true,
    });
    return;
  }

  if (product.requiresRobloxUsername) {
    const modal = new ModalBuilder()
      .setCustomId(`${USERNAME_MODAL_PREFIX}${productId}`)
      .setTitle(`Pembelian ${product.label}`);

    const usernameInput = new TextInputBuilder()
      .setCustomId(USERNAME_INPUT_ID)
      .setLabel('Username Roblox kamu')
      .setPlaceholder('Contoh: usernamekamu')
      .setStyle(TextInputStyle.Short)
      .setMinLength(3)
      .setMaxLength(50)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(usernameInput));
    await interaction.showModal(modal);
    return;
  }

  // Produk yang tidak butuh username roblox -- belum ada kasus ini saat ini.
  await interaction.reply({ content: '⚠️ Produk ini belum didukung.', ephemeral: true });
}

// ---------------------------------------------------------------------------
// 2. Submit modal username -> cek ke Roblox -> tampilkan konfirmasi
// ---------------------------------------------------------------------------
async function handleUsernameModalSubmit(interaction) {
  const productId = interaction.customId.slice(USERNAME_MODAL_PREFIX.length);
  const product = getProductById(productId);
  const inputUsername = interaction.fields.getTextInputValue(USERNAME_INPUT_ID).trim();

  await interaction.deferReply({ ephemeral: true });

  let resolved;
  try {
    resolved = await roblox.resolveUsername(inputUsername);
  } catch (err) {
    console.error('[Store] Gagal resolve username Roblox:', err);
    await interaction.editReply('⚠️ Terjadi gangguan saat menghubungi server Roblox. Coba lagi dalam beberapa saat.');
    return;
  }

  if (!resolved) {
    await interaction.editReply(
      `🔴 Username Roblox \`${inputUsername}\` tidak ditemukan. Cek kembali ejaan username kamu dan pilih produk lagi di panel Store.`
    );
    return;
  }

  const duplicateRobloxTicket = await getActiveTicketByRobloxOrHeal(interaction.guild, {
    robloxUserId: resolved.userId,
    robloxUsername: resolved.username,
  });
  if (duplicateRobloxTicket) {
    await interaction.editReply(
      `⚠️ Akun Roblox **${resolved.username}** sudah memiliki ticket aktif: <#${duplicateRobloxTicket.channelId}>. ` +
      'Satu username Roblox hanya bisa memiliki 1 ticket aktif.'
    );
    return;
  }

  const avatarUrl = await roblox.getAvatarUrl(resolved.userId);

  prunePending();
  pendingConfirmations.set(interaction.user.id, {
    productId,
    username: resolved.username,
    displayName: resolved.displayName,
    userId: resolved.userId,
    avatarUrl,
    createdAt: Date.now(),
  });

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CONFIRM_YES_ID).setLabel('Ya, Lanjutkan').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CONFIRM_NO_ID).setLabel('Tidak, Batalkan').setEmoji('❌').setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({
    embeds: [
      buildRobloxConfirmEmbed({
        username: resolved.username,
        displayName: resolved.displayName,
        avatarUrl,
        productLabel: product?.label || productId,
      }),
    ],
    components: [confirmRow],
  });
}

// ---------------------------------------------------------------------------
// 3. Klik tombol Ya / Tidak
// ---------------------------------------------------------------------------
async function handleConfirmButton(interaction) {
  prunePending();
  const pending = pendingConfirmations.get(interaction.user.id);

  if (!pending) {
    await interaction.update({
      content: '⚠️ Sesi konfirmasi sudah kadaluarsa. Silakan pilih produk lagi di panel Store.',
      embeds: [],
      components: [],
    });
    return;
  }

  if (interaction.customId === CONFIRM_NO_ID) {
    pendingConfirmations.delete(interaction.user.id);
    await interaction.update({
      content: '🚫 Dibatalkan. Silakan pilih produk lagi di panel Store kalau ingin coba lagi.',
      embeds: [],
      components: [],
    });
    return;
  }

  // CONFIRM_YES_ID
  const product = getProductById(pending.productId);
  if (!product || !product.enabled) {
    pendingConfirmations.delete(interaction.user.id);
    await interaction.update({ content: '⚠️ Produk sudah tidak tersedia.', embeds: [], components: [] });
    return;
  }

  if (!isStoreOpen()) {
    pendingConfirmations.delete(interaction.user.id);
    await interaction.update({ content: '🔴 Toko sedang tutup. Dibatalkan.', embeds: [], components: [] });
    return;
  }

  const existingTicket = await getActiveTicketOrHeal(interaction.guild, interaction.user.id);
  if (existingTicket) {
    pendingConfirmations.delete(interaction.user.id);
    await interaction.update({
      content: `⚠️ Kamu sudah punya ticket aktif: <#${existingTicket.channelId}>.`,
      embeds: [],
      components: [],
    });
    return;
  }

  const duplicateRobloxTicket = await getActiveTicketByRobloxOrHeal(interaction.guild, {
    robloxUserId: pending.userId,
    robloxUsername: pending.username,
  });
  if (duplicateRobloxTicket) {
    pendingConfirmations.delete(interaction.user.id);
    await interaction.update({
      content:
        `⚠️ Akun Roblox **${pending.username}** sudah memiliki ticket aktif: <#${duplicateRobloxTicket.channelId}>. ` +
        'Satu username Roblox hanya bisa memiliki 1 ticket aktif.',
      embeds: [],
      components: [],
    });
    return;
  }

  const uniqueCode = ticketStore.allocateUniqueCode();
  if (uniqueCode === null) {
    await interaction.update({
      content: '⚠️ Sedang banyak pesanan masuk, semua kode unik terpakai. Coba lagi dalam beberapa saat.',
      embeds: [],
      components: [],
    });
    return;
  }

  await interaction.update({ content: '⏳ Membuat ticket pesanan kamu...', embeds: [], components: [] });

  try {
    const { channel, ticket } = await createTicketChannel({
      guild: interaction.guild,
      buyerId: interaction.user.id,
      product,
      robloxUsername: pending.username,
      robloxUserId: pending.userId,
      uniqueCode,
    });

    pendingConfirmations.delete(interaction.user.id);

    await interaction.editReply({ content: `✅ Ticket pesanan kamu berhasil dibuat: <#${channel.id}>` });

    const guildIconUrl = interaction.guild?.iconURL({ size: 128 }) || null;
    const openTicketRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Buka Ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${interaction.guild.id}/${channel.id}`)
    );

    interaction.user
      .send({
        embeds: [buildTicketCreatedDmEmbed({ ticket, channelId: channel.id, guildIconUrl })],
        components: [openTicketRow],
      })
      .catch(() => {
        // DM tertutup -- tidak masalah, buyer tetap bisa akses via channel ticket-nya.
      });
  } catch (err) {
    console.error('[Store] Gagal membuat ticket:', err);
    await interaction.editReply({
      content: '⚠️ Gagal membuat ticket. Silakan hubungi staff kami secara manual.',
    });
  }
}

// ---------------------------------------------------------------------------
// Helper: buat channel ticket + kirim embed pesanan + QRIS
// ---------------------------------------------------------------------------
async function createTicketChannel({ guild, buyerId, product, robloxUsername, robloxUserId, uniqueCode }) {
  const safeUsername = robloxUsername.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const prefix = product.ticketPrefix || product.id;
  // Produk dengan channelNamePrefix: <prefix><kodeunik>-<username> (mis. gold-kks123-budi).
  // Produk lain tetap: ticket-<prefix>-<username>.
  const channelName = (
    product.channelNamePrefix
      ? `${product.channelNamePrefix}${uniqueCode}-${safeUsername || buyerId}`
      : `ticket-${prefix}-${safeUsername || buyerId}`
  ).slice(0, 90);

  const overwrites = [
    { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: buyerId,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
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
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    });
  }

  if (guild.ownerId && guild.ownerId !== buyerId) {
    overwrites.push({
      id: guild.ownerId,
      type: OverwriteType.Member,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  // Pilih/buat kategori khusus produk (maks 50 channel per kategori), lalu buat channel ticket-nya.
  // Dijalankan berurutan (runExclusive) supaya 2 pembeli bersamaan tidak berebut slot terakhir.
  const channel = await runExclusive(async () => {
    const category = await getOrCreateCategory(guild, {
      productKey: product.id,
      baseName: product.categoryName || product.label,
      legacyCategoryId: product.useLegacyCategory ? config.ticketCategoryId : null,
    });
    return guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: overwrites,
    });
  });

  const price = product.price;
  const ticket = ticketStore.createTicket({
    channelId: channel.id,
    buyerId,
    productId: product.id,
    productLabel: product.label,
    robloxUsername,
    robloxUserId,
    price,
    uniqueCode,
  });

  const guildIconUrl = guild.iconURL({ size: 128 }) || null;
  const qrisBuffer = await generateDynamicQrisImage(ticket.total);
  const attachment = new AttachmentBuilder(qrisBuffer, { name: 'qris.png' });

  const embed = buildTicketEmbed({ ticket, guildIconUrl }).setImage(QRIS_ATTACHMENT_URL);

  const closeRow = buildTicketButtonsRow({ state: 'none' });

  const ticketMessage = await channel.send({
    content: `<@${buyerId}>`,
    embeds: [embed],
    files: [attachment],
    components: [closeRow],
  });
  ticketStore.setTicketMessageId(channel.id, ticketMessage.id);

  // Embed pengingat batas waktu bayar (info saja, tidak ada auto-close -- staff yang menutup manual).
  try {
    await channel.send({ embeds: [buildPaymentDeadlineEmbed({ ticket })] });
  } catch (err) {
    console.warn('[Store] Gagal kirim embed batas waktu pembayaran:', err.message);
  }

  return { channel, ticket };
}

function buildTicketButtonsRow({ state }) {
  const confirmBtn = new ButtonBuilder()
    .setCustomId(CONFIRM_PAYMENT_BUTTON_ID)
    .setEmoji('✅')
    .setStyle(ButtonStyle.Success);
  if (state === 'received') confirmBtn.setLabel('Dana Diterima').setEmoji('💰').setStyle(ButtonStyle.Success).setDisabled(true);
  else if (state === 'claimed') confirmBtn.setLabel('Menunggu Verifikasi').setEmoji('🕐').setStyle(ButtonStyle.Secondary).setDisabled(true);
  else confirmBtn.setLabel('Konfirmasi Pembayaran');

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CLOSE_TICKET_BUTTON_ID).setLabel('Tutup Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    confirmBtn
  );
}

// ---------------------------------------------------------------------------
// 4-0. Pembeli klik "Konfirmasi Pembayaran" -> minta kirim bukti bayar, tandai menunggu verifikasi staff
// ---------------------------------------------------------------------------
async function handleConfirmPaymentButton(interaction) {
  const ticket = ticketStore.getTicketByChannelId(interaction.channelId);
  if (!ticket || ticket.status !== 'open') {
    await interaction.reply({ content: '⚠️ Ticket ini sudah tidak aktif.', ephemeral: true });
    return;
  }

  if (interaction.user.id !== ticket.buyerId) {
    await interaction.reply({
      content: '🚫 Tombol ini khusus untuk pembeli pemilik ticket ini.',
      ephemeral: true,
    });
    return;
  }

  const claimed = ticketStore.confirmPayment(interaction.channelId, { confirmedById: interaction.user.id });
  if (!claimed) {
    await interaction.reply({
      content: 'ℹ️ Kamu sudah menekan konfirmasi pembayaran. Silakan kirim bukti pembayaranmu di channel ini dan tunggu staff memverifikasi.',
      ephemeral: true,
    });
    return;
  }

  // Update pesan ticket: status pembayaran di embed + tombol jadi nonaktif.
  const baseEmbed = interaction.message.embeds?.[0];
  const embed = baseEmbed ? EmbedBuilder.from(baseEmbed).setImage(QRIS_ATTACHMENT_URL) : null;
  if (embed) {
    const newField = { name: PAYMENT_STATUS_FIELD_NAME, value: '🕐 Pembeli sudah konfirmasi bayar — menunggu bukti pembayaran & verifikasi staff' };
    const fields = embed.data.fields || [];
    const fIdx = fields.findIndex((f) => f.name === PAYMENT_STATUS_FIELD_NAME);
    if (fIdx >= 0) embed.spliceFields(fIdx, 1, newField);
    else embed.addFields(newField);
  }

  await interaction.update({
    ...(embed ? { embeds: [embed] } : {}),
    components: [buildTicketButtonsRow({ state: 'claimed' })],
  });

  const staffMention = config.storeStaffRoleId ? `<@&${config.storeStaffRoleId}>` : '';
  await interaction.followUp({
    content:
      `<@${ticket.buyerId}>` +
      (staffMention ? ` • ${staffMention} pembeli menyatakan sudah membayar, mohon dicek.` : ''),
    embeds: [buildPaymentClaimedEmbed({ ticket, guildIconUrl: interaction.guild?.iconURL({ size: 128 }) || null })],
    allowedMentions: {
      users: [ticket.buyerId],
      roles: config.storeStaffRoleId ? [config.storeStaffRoleId] : [],
    },
  });
}

// ---------------------------------------------------------------------------
// 4-1. /danamasuk (staff) -> tandai dana sudah masuk, beri tahu pembeli produk segera dikirim
// ---------------------------------------------------------------------------
async function handleFundsReceivedCommand(interaction) {
  if (!interaction.inGuild() || !isStaffOrOwner(interaction.member, interaction.guild)) {
    await interaction.reply({ content: '🚫 Perintah ini hanya untuk staff atau owner.', ephemeral: true });
    return;
  }

  const ticket = ticketStore.getTicketByChannelId(interaction.channelId);
  if (!ticket || ticket.status !== 'open') {
    await interaction.reply({
      content: '⚠️ Perintah ini hanya bisa dipakai di dalam channel ticket yang masih aktif.',
      ephemeral: true,
    });
    return;
  }

  const updated = ticketStore.markFundsReceived(interaction.channelId, { receivedById: interaction.user.id });
  if (!updated) {
    await interaction.reply({ content: 'ℹ️ Dana untuk ticket ini sudah ditandai masuk sebelumnya.', ephemeral: true });
    return;
  }

  await interaction.reply({
    content: `<@${ticket.buyerId}>`,
    embeds: [
      buildFundsReceivedEmbed({
        ticket,
        staffId: interaction.user.id,
        guildIconUrl: interaction.guild?.iconURL({ size: 128 }) || null,
      }),
    ],
    allowedMentions: { users: [ticket.buyerId] },
  });

  // Update pesan ticket utama (status pembayaran + tombol) kalau masih bisa ditemukan.
  try {
    if (ticket.ticketMessageId) {
      const msg = await interaction.channel.messages.fetch(ticket.ticketMessageId);
      const baseEmbed = msg.embeds?.[0];
      const payload = { components: [buildTicketButtonsRow({ state: 'received' })] };
      if (baseEmbed) {
        const embed = EmbedBuilder.from(baseEmbed).setImage(QRIS_ATTACHMENT_URL);
        const newField = { name: PAYMENT_STATUS_FIELD_NAME, value: `💰 Dana masuk — diverifikasi oleh <@${interaction.user.id}>. Produk segera dikirim.` };
        const fields = embed.data.fields || [];
        const fIdx = fields.findIndex((f) => f.name === PAYMENT_STATUS_FIELD_NAME);
        if (fIdx >= 0) embed.spliceFields(fIdx, 1, newField);
        else embed.addFields(newField);
        payload.embeds = [embed];
      }
      await msg.edit(payload);
    }
  } catch (err) {
    console.warn('[Store] Gagal update pesan ticket setelah /danamasuk:', err.message);
  }
}

// ---------------------------------------------------------------------------
// 4a. Klik tombol "Tutup Ticket" -> tampilkan dropdown pilihan status
// ---------------------------------------------------------------------------
async function handleCloseButton(interaction) {
  const ticket = ticketStore.getTicketByChannelId(interaction.channelId);
  if (!ticket || ticket.status !== 'open') {
    await interaction.reply({ content: '⚠️ Ticket ini sudah tidak aktif.', ephemeral: true });
    return;
  }

  if (!isStaffOrOwner(interaction.member, interaction.guild)) {
    await interaction.reply({ content: '🚫 Hanya staff atau owner yang bisa menutup ticket ini.', ephemeral: true });
    return;
  }

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(CLOSE_SELECT_ID)
      .setPlaceholder('Pilih status penutupan ticket...')
      .addOptions(CLOSE_STATUS_OPTIONS)
  );

  await interaction.reply({
    content: 'Pilih status penutupan ticket ini:',
    components: [selectRow],
    ephemeral: true,
  });
}

// ---------------------------------------------------------------------------
// 4b. Pilih status di dropdown -> tampilkan modal catatan admin
// ---------------------------------------------------------------------------
async function handleCloseSelect(interaction) {
  const ticket = ticketStore.getTicketByChannelId(interaction.channelId);
  if (!ticket || ticket.status !== 'open') {
    await interaction.update({ content: '⚠️ Ticket ini sudah tidak aktif.', components: [] });
    return;
  }

  if (!isStaffOrOwner(interaction.member, interaction.guild)) {
    await interaction.update({ content: '🚫 Hanya staff atau owner yang bisa menutup ticket ini.', components: [] });
    return;
  }

  const closeStatus = interaction.values[0]; // completed|cancelled|refunded

  const modal = new ModalBuilder()
    .setCustomId(`${CLOSE_MODAL_PREFIX}${closeStatus}`)
    .setTitle('Catatan Penutupan Ticket');

  const noteInput = new TextInputBuilder()
    .setCustomId(CLOSE_NOTE_INPUT_ID)
    .setLabel('Catatan (opsional)')
    .setPlaceholder('Contoh: Produk sudah dikirim ke inventory')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(noteInput));
  await interaction.showModal(modal);
}

// ---------------------------------------------------------------------------
// 5. Submit modal catatan -> tutup ticket & kirim log order
// ---------------------------------------------------------------------------
async function handleCloseModalSubmit(interaction) {
  const closeStatus = interaction.customId.slice(CLOSE_MODAL_PREFIX.length); // completed|cancelled|refunded
  const note = interaction.fields.getTextInputValue(CLOSE_NOTE_INPUT_ID)?.trim() || '';

  const ticket = ticketStore.getTicketByChannelId(interaction.channelId);
  if (!ticket || ticket.status !== 'open') {
    await interaction.reply({ content: '⚠️ Ticket ini sudah tidak aktif.', ephemeral: true });
    return;
  }

  const closedTicket = ticketStore.closeTicket(interaction.channelId, {
    status: closeStatus,
    note,
    closedById: interaction.user.id,
  });

  await interaction.reply({
    content: `✅ Ticket ditutup dengan status **${closeStatus.toUpperCase()}**. Channel ini akan terhapus dalam 10 detik...`,
  });

  const guildIconUrl = interaction.guild?.iconURL({ size: 128 }) || null;
  if (config.orderLogChannelId) {
    try {
      const logChannel = await interaction.client.channels.fetch(config.orderLogChannelId);
      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({
          content: `<@${closedTicket.buyerId}>`,
          embeds: [
            buildOrderStatusEmbed({
              ticket: closedTicket,
              closeStatus,
              note,
              closedByTag: interaction.user.tag,
              guildIconUrl,
            }),
          ],
        });
      }
    } catch (err) {
      console.error('[Store] Gagal kirim log order:', err);
    }
  }

  // Status Completed -> DM pembeli: produk sudah dikirim + catatan admin.
  if (closeStatus === 'completed') {
    try {
      const buyer = await interaction.client.users.fetch(closedTicket.buyerId);
      await buyer.send({
        embeds: [
          buildProductDeliveredDmEmbed({
            ticket: closedTicket,
            note,
            closedByTag: interaction.user.tag,
            guildIconUrl,
          }),
        ],
      });
    } catch (err) {
      // DM pembeli tertutup / tidak bisa dikirim -- tidak masalah, pembeli tetap ditag di channel log.
      console.warn(`[Store] Tidak bisa DM pembeli ${closedTicket.buyerId}: ${err.message}`);
    }
  }

  setTimeout(() => {
    interaction.channel.delete().catch((err) => {
      console.error('[Store] Gagal menghapus channel ticket:', err);
    });
  }, 10_000);
}

module.exports = {
  USERNAME_MODAL_PREFIX,
  CONFIRM_YES_ID,
  CONFIRM_NO_ID,
  CLOSE_TICKET_BUTTON_ID,
  CONFIRM_PAYMENT_BUTTON_ID,
  CLOSE_SELECT_ID,
  CLOSE_MODAL_PREFIX,
  handleProductSelect,
  handleUsernameModalSubmit,
  handleConfirmButton,
  handleConfirmPaymentButton,
  handleFundsReceivedCommand,
  handleCloseButton,
  handleCloseSelect,
  handleCloseModalSubmit,
};
