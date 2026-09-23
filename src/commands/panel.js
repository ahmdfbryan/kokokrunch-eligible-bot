const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');
const { writeStickyPanel } = require('../services/stickyPanelStore');

const ROBLOX_COMMUNITY_URL = 'https://www.roblox.com/id/communities/625247444/KokoKrunch-Studios';
const CHECK_ACCOUNT_BUTTON_ID = 'panel_cek_akun';

function buildPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🔍 CEK STATUS AKUN')
    .setDescription(
      'Apabila belum bergabung ke komunitas, silakan join terlebih dahulu dan tunggu selama ' +
      '**14 hari** hingga memenuhi syarat untuk melakukan order robux komunitas.'
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CHECK_ACCOUNT_BUTTON_ID)
      .setLabel('Cek Akun Anda')
      .setEmoji('🔍')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel('Link Komunitas KokoKrunch')
      .setEmoji('🔗')
      .setStyle(ButtonStyle.Link)
      .setURL(ROBLOX_COMMUNITY_URL)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = {
  CHECK_ACCOUNT_BUTTON_ID,
  buildPanelPayload,

  data: new SlashCommandBuilder()
    .setName('panel-cek-status')
    .setDescription('Kirim panel Cek Status Akun ke channel ini (otomatis sticky di pesan terbawah)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.reply(buildPanelPayload());

    const sentMessage = await interaction.fetchReply();
    writeStickyPanel({ channelId: sentMessage.channelId, messageId: sentMessage.id });
  },
};
