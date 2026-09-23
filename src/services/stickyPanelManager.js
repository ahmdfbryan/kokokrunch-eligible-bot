const { readStickyPanel, writeStickyPanel } = require('./stickyPanelStore');

const STICKY_REPOST_DEBOUNCE_MS = 1500;
const stickyRepostTimers = new Map();
let panelPayloadBuilder = null;

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
