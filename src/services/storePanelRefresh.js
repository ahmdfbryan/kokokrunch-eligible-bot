const { buildStorePanelEmbed } = require('../embeds/storeEmbeds');
const { isStoreOpen } = require('./storeState');
const { getStorePanels, removeStorePanel } = require('./storePanelStore');

/**
 * Edit semua pesan panel Store yang pernah dikirim (bisa di beberapa channel)
 * supaya status Buka/Tutup di embed-nya langsung ter-update tanpa harus
 * mengirim ulang /store-panel.
 */
async function refreshStorePanels(client) {
  const panels = getStorePanels();
  if (panels.length === 0) return;

  const storeOpen = isStoreOpen();

  for (const panel of panels) {
    try {
      const channel = await client.channels.fetch(panel.channelId);
      if (!channel || !channel.isTextBased()) {
        removeStorePanel(panel.channelId);
        continue;
      }

      const message = await channel.messages.fetch(panel.messageId);
      const guildIconUrl = channel.guild?.iconURL({ size: 128 }) || null;

      await message.edit({
        embeds: [buildStorePanelEmbed({ guildIconUrl, storeOpen })],
      });
    } catch (err) {
      console.warn(`[StorePanel] Gagal refresh panel di channel ${panel.channelId}, menghapus referensi:`, err.message);
      removeStorePanel(panel.channelId);
    }
  }
}

module.exports = { refreshStorePanels };
