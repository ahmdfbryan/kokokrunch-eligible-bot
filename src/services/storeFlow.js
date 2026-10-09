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
} = require('discord.js');
const config = require('../config');
const roblox = require('../roblox');
const { getProductById, formatRupiah } = require('../data/products');
const { isStoreOpen } = require('./storeState');
const ticketStore = require('./ticketStore');
const { generateDynamicQrisImage } = require('./qris');
const {
  buildRobloxConfirmEmbed,
  buildTicketEmbed,
  buildOrderStatusEmbed,
  buildTicketCreatedDmEmbed,
} = require('../embeds/storeEmbeds');

const USERNAME_MODAL_PREFIX = 'store_username_modal_';
const USERNAME_INPUT_ID = 'roblox_username_input';
const CONFIRM_YES_ID = 'store_confirm_yes';
const CONFIRM_NO_ID = 'store_confirm_no';
const CLOSE_TICKET_BUTTON_ID = 'store_close_ticket';
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

  const existingTicket = ticketStore.getOpenTicketByBuyer(interaction.user.id);
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

  const existingTicket = ticketStore.getOpenTicketByBuyer(interaction.user.id);
  if (existingTicket) {
    pendingConfirmations.delete(interaction.user.id);
    await interaction.update({
      content: `⚠️ Kamu sudah punya ticket aktif: <#${existingTicket.channelId}>.`,
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
  const channelName = `ticket-${safeUsername || buyerId}`.slice(0, 90);

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: buyerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
  ];

  if (config.storeStaffRoleId) {
    overwrites.push({
      id: config.storeStaffRoleId,
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
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: config.ticketCategoryId || undefined,
    permissionOverwrites: overwrites,
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

  const embed = buildTicketEmbed({ ticket, guildIconUrl }).setImage('attachment://qris.png');

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CLOSE_TICKET_BUTTON_ID).setLabel('Tutup Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `<@${buyerId}>`,
    embeds: [embed],
    files: [attachment],
    components: [closeRow],
  });

  return { channel, ticket };
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

  setTimeout(() => {
    interaction.channel.delete().catch((err) =>
