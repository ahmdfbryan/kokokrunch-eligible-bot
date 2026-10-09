const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isStoreOpen, setStoreOpen } = require('../services/storeState');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('toko')
    .setDescription('Buka atau tutup Store KokoKrunch')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('status')
        .setDescription('Status toko')
        .setRequired(true)
        .addChoices({ name: 'Buka', value: 'open' }, { name: 'Tutup', value: 'close' })
    ),

  async execute(interaction) {
    const status = interaction.options.getString('status', true);
    setStoreOpen(status === 'open');

    const nowOpen = isStoreOpen();
    await interaction.reply({
      content: nowOpen
        ? '🟢 Toko sekarang **BUKA**. Pembeli bisa memilih produk di panel Store.'
        : '🔴 Toko sekarang **TUTUP**. Pembeli tidak bisa memulai pembelian baru sampai toko dibuka kembali.',
      ephemeral: true,
    });
  },
};
