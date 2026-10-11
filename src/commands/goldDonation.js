const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

const BRAND_COLOR = 0xd4af37; // emas -- konsisten dengan panel Store

const DONATE_MOUNT_LONELY_URL = 'https://sociabuzz.com/kokokrunch/donate';
const DONATE_SMA1_PARTY_URL = 'https://saweria.co/KokoKrunchRoblox';

function buildGoldDonationEmbed({ guildIconUrl }) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('🪙 Gold Donation')
    .setDescription(
      'Setiap Gold yang kamu berikan adalah dukungan nyata untuk **KokoKrunch Studios**. ' +
      'Dari sinilah kami terus mengembangkan game, merawat setiap map, dan menghadirkan pembaruan ' +
      'yang lebih baik untuk kalian semua.\n' +
      '### Cara Kerjanya:\n' +
      'Begitu donasimu masuk, pesan donasi akan **langsung muncul di map** yang kamu dukung, ' +
      'sehingga semua pemain bisa melihat siapa yang telah berkontribusi. ' +
      'Namamu juga akan **tercatat di leaderboard Gold Donation** sebagai bentuk apresiasi dari kami.\n' +
      '### Terima Kasih\n' +
      'Setiap dukungan yang kalian berikan, sekecil apa pun, sangat berarti bagi perjalanan kami. ' +
      'Terima kasih sudah menjadi bagian dari komunitas KokoKrunch Studios.\n\n' +
      '-# Pilih map yang ingin kamu dukung melalui tombol di bawah ini.'
    );

  if (guildIconUrl) {
    embed.setAuthor({ name: 'KokoKrunch Studios', iconURL: guildIconUrl }); // foto + nama server di atas judul
    embed.setThumbnail(guildIconUrl); // foto server di sisi kanan
  } else {
    embed.setAuthor({ name: 'KokoKrunch Studios' });
  }

  return embed;
}

function buildDonationButtonsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Gold Mount Lonely')
      .setEmoji('🏔️')
      .setStyle(ButtonStyle.Link)
      .setURL(DONATE_MOUNT_LONELY_URL),
    new ButtonBuilder()
      .setLabel('Gold SMA 1 Party')
      .setEmoji('🎉')
      .setStyle(ButtonStyle.Link)
      .setURL(DONATE_SMA1_PARTY_URL)
  );
}

module.exports = {
  buildGoldDonationEmbed,
  buildDonationButtonsRow,

  data: new SlashCommandBuilder()
    .setName('gold-donation')
    .setDescription('Kirim panel informasi Gold Donation ke channel ini')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const guildIconUrl = interaction.guild?.iconURL({ size: 256 }) || null;

    // Konfirmasi ephemeral dulu, panel aslinya dikirim lewat channel.send()
    // supaya tidak ada label "X used /gold-donation" di atas panel.
    await interaction.reply({
      content: '✅ Panel Gold Donation berhasil dikirim ke channel ini.',
      flags: MessageFlags.Ephemeral,
    });

    try {
      await interaction.channel.send({
        embeds: [buildGoldDonationEmbed({ guildIconUrl })],
        components: [buildDonationButtonsRow()],
      });
    } catch (err) {
      console.error('[GoldDonation] Gagal mengirim panel:', err);
      await interaction.followUp({
        content: '⚠️ Gagal mengirim panel. Pastikan bot punya izin Send Messages & Embed Links di channel ini.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    }
  },
};
