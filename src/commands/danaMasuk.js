const { SlashCommandBuilder } = require('discord.js');
const { handleFundsReceivedCommand } = require('../services/storeFlow');

module.exports = {
  // Tanpa setDefaultMemberPermissions: pengecekan staff/owner dilakukan di handler
  // (role staff dari STORE_STAFF_ROLE_ID belum tentu punya izin Manage Server).
  data: new SlashCommandBuilder()
    .setName('danamasuk')
    .setDescription('Staff: tandai dana pembayaran sudah masuk dan beri tahu pembeli produk akan segera dikirim'),

  async execute(interaction) {
    await handleFundsReceivedCommand(interaction);
  },
};
