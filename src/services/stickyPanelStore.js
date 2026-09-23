const { readStickyPanel, writeStickyPanel } = require('./stickyPanelStore');

const STICKY_REPOST_DEBOUNCE_MS = 1500;
const stickyRepostTimers = new Map();

let panelPayloadBuilder = null;

/**
 * Wajib dipanggil sekali saat startup (di index.js) supaya modul ini tahu
 * cara membangun ulang isi panel (embed + tombol) saat repost.
 */
function registerPanelPayloadBuilder(builderFn) {
  panelPayloadBuilder = builderFn;
}

async function repostStickyPanel(client, channelId) {
  const sticky = readStickyPanel();
  if (!sticky || sticky.channelId !== channelId) return;
  if (!panelPayloadBuilder) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return;

    try {
      const oldMessage = await channel.messages.fetch(sticky.messageId);
      await oldMessage.delete();
    } catch (err) {
      console.warn(`[StickyPanel] Tidak bisa hapus panel lama (${sticky.messageId}): ${err.message}`);
    }

    const newMessage = await channel.send(panelPayloadBuilder());
    writeStickyPanel({ channelId, messageId: newMessage.id });
  } catch (err) {
    console.error(`[StickyPanel] Gagal repost panel di channel ${channelId}:`, err);
  }
}

/**
 * Jadwalkan repost (dengan debounce). Dipakai oleh:
 * 1. Listener pesan baru di index.js (saat ada chat biasa dari user/bot lain)
 * 2. Dipanggil manual tepat setelah bot kirim hasil pengecekan eligibility
 *    (dari /eligible ATAU dari tombol "Cek Akun Anda"), supaya panel ikut
 *    "turun" ke bawah hasil itu juga -- tanpa perlu mendeteksi pesan bot
 *    sendiri lewat event listener (yang riskan infinite-loop).
 */
function scheduleStickyRepost(client, channelId) {
  const sticky = readStickyPanel();
  if (!sticky || sticky.channelId !== channelId) return;

  if (stickyRepostTimers.has(channelId)) {
    clearTimeout(stickyRepostTimers.get(channelId));
  }
  const timer = setTimeout(() => {
    stickyRepostTimers.delete(channelId);
    repostStickyPanel(client, channelId).catch((err) =>
      console.error('[StickyPanel] Unhandled error saat repost:', err)
    );
  }, STICKY_REPOST_DEBOUNCE_MS);
  stickyRepostTimers.set(channelId, timer);
}

module.exports = { registerPanelPayloadBuilder, scheduleStickyRepost };
