const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const config = require('../config');
const { PRODUCTS } = require('../data/products');
const { buildStorePanelEmbed } = require('../embeds/storeEmbeds');
const { isStoreOpen } = require('../services/storeState');

const STORE_SELECT_MENU_ID = 'store_product_select';

function buildStoreSelectRow() {
  const select = new StringSelectMenuBuilder()
    .setCustomId(STORE_SELECT_MENU_ID)
    .setPlaceholder('🛍️ Pilih produk yang ingin dibeli...')
    .addOptions(
      PRODUCTS.map((p) => ({
        label: p.label,
        value: p.id,
        description: p.enabled ? `${p.description}` : 'Belum tersedia saat ini',
        emoji: p.emoji,
      }))
    );

  return new ActionRowBuilder().addComponents(select);
}

function buildStorePanelPayload({ guildIconUrl }) {
  return {
    embeds: [buildStorePanelEmbed({ guildIconUrl, storeOpen: isStoreOpen() })],
    components: [buildStoreSelectRow()],
  };
}

function getMissingConfigVars() {
  const missing = [];
  if (!config.ticketCategoryId) missing.push('TICKET_CATEGORY_ID');
  if (!config.storeStaffRoleId) missing.push('STORE_STAFF_ROLE_ID');
  if (!config.orderLogChannelId) missing.push('ORDER_LOG_CHANNEL_ID');
  if (!config.qrisStaticPayload) missing.push('QRIS_STATIC_PAYLOAD');
  return missing;
}

module.exports = {
  STORE_SELECT_MENU_ID,
  buildStoreSelectRow,
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
    await interaction.reply(buildStorePanelPayload({ guildIconUrl }));
  },
};
