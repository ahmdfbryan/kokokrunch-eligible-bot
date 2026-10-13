const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { readStickyPanel, clearStickyPanel } = require('../services/stickyPanelStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('matikan-panel-sticky')
    .setDescription('Matikan panel sticky Cek Status Akun (panel tidak lagi dikirim ulang ke pesan terbawah)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((option) =>
      option
        .setName('hapus_panel')
        .setDescription('Hapus juga pesan panel yang terakhir? (default: tidak, panel dibiarkan di channel)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const sticky = readStickyPanel();
    if (!sticky) {
      await interaction.reply({
        content: 'ℹ️ Panel sticky sedang tidak aktif, tidak ada yang perlu dimatikan.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const deletePanel = interaction.options.getBoolean('hapus_panel') ?? false;

    // Hapus data sticky dulu -- sejak ini panel tidak akan di-repost lagi
    // (repost yang sudah terjadwal juga otomatis batal karena data sticky sudah tidak ada).
    clearStickyPanel();

    let deleted = false;
    if (deletePanel) {
      try {
        const channel = await interaction.client.channels.fetch(sticky.channelId);
        const message = await channel.messages.fetch(sticky.messageId);
        await message.delete();
        deleted = true;
      } catch (err) {
        console.warn(`[StickyPanel] Tidak bisa hapus pesan panel (${sticky.messageId}): ${err.message}`);
      }
    }

    const lines = [`✅ Panel sticky di <#${sticky.channelId}> sudah **dimatikan**. Panel tidak akan dikirim ulang lagi.`];
    if (deletePanel) {
      lines.push(deleted ? '🗑️ Pesan panel terakhir juga sudah dihapus.' : '⚠️ Pesan panel terakhir tidak bisa dihapus (mungkin sudah terhapus atau bot tidak punya izin).');
    } else {
      lines.push('Pesan panel yang terakhir dibiarkan di channel. Untuk menyalakan lagi, jalankan `/panel-cek-status`.');
    }

    await interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
  },
};
