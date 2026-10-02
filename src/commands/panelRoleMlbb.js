const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');

// Ganti ID ini kalau role Mobile Legend-nya berubah.
const MLBB_ROLE_ID = '1555629666293907496';
const TOGGLE_ROLE_BUTTON_ID = 'toggle_role_mlbb';

function buildRoleMlbbPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎮 Role Mobile Legend: Bang Bang')
    .setDescription(
      'Klik tombol di bawah untuk mendapatkan role MLBB (supaya kebagian notifikasi & akses obrolan seputar Mobile Legend). ' +
      'Klik lagi kalau mau melepas role-nya.'
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(TOGGLE_ROLE_BUTTON_ID)
      .setLabel('Ambil / Lepas Role MLBB')
      .setEmoji('🎮')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = {
  MLBB_ROLE_ID,
  TOGGLE_ROLE_BUTTON_ID,
  buildRoleMlbbPanelPayload,

  data: new SlashCommandBuilder()
    .setName('panel-role-mlbb')
    .setDescription('Kirim panel ambil/lepas role Mobile Legend ke channel ini')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.reply(buildRoleMlbbPanelPayload());
  },
};
