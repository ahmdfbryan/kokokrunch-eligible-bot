const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const config = require('../config');
const { PRODUCTS } = require('../data/products');
const { buildStorePanelEmbed } = require('../embeds/storeEmbeds');
const { isStoreOpen } = require('../services/storeState');
const { addStorePanel } = require('../services/storePanelStore');

// Dropdown lama (dipertahankan hanya supaya panel lama yang belum ter-refresh tetap berfungsi).
const STORE_SELECT_MENU_ID = 'store_product_select';
// Tombol produk: customId = prefix + id produk, mis. "store_product_btn_golden_pet".
const STORE_PRODUCT_BUTTON_PREFIX = 'store_product_btn_';

/** Satu tombol per produk (maks 5 per baris). Produk yang belum tersedia tampil abu-abu. */
function buildStoreButtonRows() {
  const rows = [];
  for (let i = 0; i < PRODUCTS.length; i += 5) {
    const row = new ActionRowBuilder().addComponents(
      PRODUCTS.slice(i, i + 5).map((p) =>
        new ButtonBuilder()
          .setCustomId(`${STORE_PRODUCT_BUTTON_PREFIX}${p.id}`)
          .setLabel(p.label)
          .setEmoji(p.emoji)
          .setStyle(p.enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
      )
    );
    rows.push(row);
  }
  return rows;
}

function buildStorePanelPayload({ guildIconUrl }) {
  return {
    embeds: [buildStorePanelEmbed({ guildIconUrl, storeOpen: isStoreOpen() })],
    components: buildStoreButtonRows(),
  };
}

function getMissingConfigVars() {
  const missing = [];
  if (!config.storeStaffRoleId) missing.push('STORE_STAFF_ROLE_ID');
  if (!config.orderLogChannelId) missing.push('ORDER_LOG_CHANNEL_ID');
  if (!config.qrisStaticPayload) missing.push('QRIS_STATIC_PAYLOAD');
  return missing;
}

module.exports = {
  STORE_SELECT_MENU_ID,
  STORE_PRODUCT_BUTTON_PREFIX,
  buildStoreButtonRows,
  buildStorePanelPayload,
  getMissingConfigVars,

  data: new SlashCommandBuilder()
    .setName('store-panel')
    .setDescription('Kirim panel Store KokoKrunch ke channel ini')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const missing = getMissingConfigVars();
    if (missing.length > 0) {
      await interaction.reply({
        content:
          `⚠️ Fitur Store belum bisa dipakai karena env var berikut belum diisi di \`.env\`:\n` +
          missing.map((m) => `\`${m}\``).join(', '),
        ephemeral: true,
      });
      return;
    }

    const guildIconUrl = interaction.guild?.iconURL({ size: 128 }) || null;

    // Balas ephemeral dulu (cuma kelihatan oleh yang jalanin command), supaya
    // panel yang dikirim ke channel (lewat channel.send di bawah) bersih --
    // tidak ada keterangan "X used /store-panel" di atasnya.
    await interaction.reply({ content: '✅ Panel Store berhasil dikirim ke channel ini.', ephemeral: true });

    try {
      const sentMessage = await interaction.channel.send(buildStorePanelPayload({ guildIconUrl }));
      addStorePanel({ channelId: interaction.channelId, messageId: sentMessage.id });
    } catch (err) {
      console.error('[Store] Gagal mengirim/menyimpan referensi panel Store:', err);
    }
  },
};
