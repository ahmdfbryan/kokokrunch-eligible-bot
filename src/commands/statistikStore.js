const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { isStaffOrOwner } = require('../services/storeFlow');
const { getStats } = require('../services/ticketStore');
const { formatRupiah } = require('../data/products');

module.exports = {
  // Tanpa setDefaultMemberPermissions: pengecekan staff/owner dilakukan di execute()
  // (role staff dari STORE_STAFF_ROLE_ID belum tentu punya izin Manage Server).
  data: new SlashCommandBuilder()
    .setName('statistik-store')
    .setDescription('Staff: lihat statistik transaksi Store (hanya kamu yang bisa melihat)'),

  async execute(interaction) {
    if (!interaction.inGuild() || !isStaffOrOwner(interaction.member, interaction.guild)) {
      await interaction.reply({
        content: '🚫 Perintah ini hanya untuk staff atau owner.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const s = getStats();
    const embed = new EmbedBuilder()
      .setColor(0xd4af37)
      .setTitle('📊 Statistik Store')
      .addFields(
        { name: '✅ Transaksi Berhasil', value: `**${s.completed.count}** transaksi`, inline: true },
        { name: '💰 Total Omzet', value: `**${formatRupiah(s.completed.revenue)}**`, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: '📅 Hari Ini', value: `${s.today.count} transaksi • ${formatRupiah(s.today.revenue)}`, inline: true },
        { name: '🗓️ Bulan Ini', value: `${s.month.count} transaksi • ${formatRupiah(s.month.revenue)}`, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: '🚫 Dibatalkan', value: `${s.cancelled}`, inline: true },
        { name: '💸 Direfund', value: `${s.refunded}`, inline: true },
        { name: '🕐 Ticket Aktif', value: `${s.open}`, inline: true }
      )
      .setFooter({ text: `KokoKrunch Studios • Total ${s.total} ticket tercatat • waktu WIB` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
