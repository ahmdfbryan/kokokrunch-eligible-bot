const path = require('path');
const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

const BRAND_COLOR = 0xd4af37; // emas -- konsisten dengan panel Store & Gold Donation
const GOLD_DONATION_CHANNEL_ID = '1558720445694607441';
const ASSET_DIR = path.join(__dirname, '..', '..', 'assets', 'how-to-donate');
const TRANSLATE_BUTTON_ID = 'how_to_donate_translate_en';

const STEPS = [
  {
    file: 'step-1.jpg',
    title: 'Langkah 1 • Kunjungi Halaman Donasi',
    description:
      'Kunjungi halaman donasi resmi **Mount Lonely** atau **SMA 1 Party** melalui link yang telah ' +
      `disediakan di channel <#${GOLD_DONATION_CHANNEL_ID}>, setelah itu pilih atau masukkan ` +
      'nominal yang ingin kamu donasikan.',
  },
  {
    file: 'step-2.jpg',
    title: 'Langkah 2 • Isi Nama dan Data Diri',
    description:
      'Pada kolom **Nama**, pastikan kamu memasukkan **username Roblox** yang benar, ' +
      'bukan Display Name ataupun nickname, dan lengkapi seluruh data yang diminta.',
  },
  {
    file: 'step-3.jpg',
    title: 'Langkah 3 • Pilih Metode Pembayaran',
    description: 'Pilih metode pembayaran yang tersedia pada website tersebut.',
  },
  {
    file: 'step-4.jpg',
    title: 'Langkah 4 • Selesaikan Pembayaran',
    description:
      'Selesaikan pembayaran sesuai instruksi yang muncul. Setelah donasi berhasil, sistem akan ' +
      'secara otomatis menampilkan **Gold Donation** pada map yang kamu pilih.',
  },
];

function buildEnglishEmbed({ guildIconUrl } = {}) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('How to Donate')
    .setDescription(
      '### Step 1 • Visit the Donation Page\n' +
      'Visit the official **Mount Lonely** or **SMA 1 Party** donation page through the links provided in ' +
      `<#${GOLD_DONATION_CHANNEL_ID}>, then choose or enter the amount you would like to donate.\n` +
      '### Step 2 • Fill In Your Name and Details\n' +
      'In the **Name** field, make sure you enter your correct **Roblox username**, ' +
      'not your Display Name or nickname, and complete all of the required details.\n' +
      '### Step 3 • Choose a Payment Method\n' +
      'Choose from the payment methods available on the website.\n' +
      '### Step 4 • Complete the Payment\n' +
      'Complete the payment following the instructions shown. Once your donation is successful, ' +
      'the system will automatically display your **Gold Donation** on the map you selected.'
    );

  if (guildIconUrl) embed.setAuthor({ name: 'KokoKrunch Studios', iconURL: guildIconUrl });
  return embed;
}

function buildTranslateRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(TRANSLATE_BUTTON_ID)
      .setLabel('Translate to English')
      .setEmoji('🌐')
      .setStyle(ButtonStyle.Secondary)
  );
}

/** Klik tombol "Translate to English" -> kirim versi Inggris, hanya terlihat oleh yang klik. */
async function handleTranslateButton(interaction) {
  const guildIconUrl = interaction.guild?.iconURL({ size: 128 }) || null;
  await interaction.reply({
    embeds: [buildEnglishEmbed({ guildIconUrl })],
    flags: MessageFlags.Ephemeral,
  });
}

function buildHowToDonatePayload({ guildIconUrl } = {}) {
  const embeds = [];
  const files = [];

  STEPS.forEach((step, index) => {
    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle(step.title)
      .setDescription(step.description)
      .setImage(`attachment://${step.file}`);

    // Footer hanya di embed terakhir (Langkah 4): foto server + "Made by ..." + waktu.
    if (index === STEPS.length - 1) {
      embed
        .setFooter({ text: 'Made by KokoKrunch Studios', iconURL: guildIconUrl || undefined })
        .setTimestamp();
    }

    embeds.push(embed);
    files.push(new AttachmentBuilder(path.join(ASSET_DIR, step.file), { name: step.file }));
  });

  return { embeds, files, components: [buildTranslateRow()] };
}

module.exports = {
  TRANSLATE_BUTTON_ID,
  buildHowToDonatePayload,
  handleTranslateButton,

  data: new SlashCommandBuilder()
    .setName('how-to-donate')
    .setDescription('Kirim panduan cara donasi (4 langkah) ke channel ini')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    let payload;
    try {
      payload = buildHowToDonatePayload({ guildIconUrl: interaction.guild?.iconURL({ size: 128 }) || null });
    } catch (err) {
      console.error('[HowToDonate] Gagal menyiapkan panduan:', err);
      await interaction.reply({
        content: '⚠️ Gagal menyiapkan panduan donasi.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Konfirmasi ephemeral dulu, panduan aslinya dikirim lewat channel.send()
    // supaya tidak ada label "X used /how-to-donate" di atasnya.
    await interaction.reply({
      content: '✅ Panduan donasi berhasil dikirim ke channel ini.',
      flags: MessageFlags.Ephemeral,
    });

    try {
      await interaction.channel.send(payload);
    } catch (err) {
      console.error('[HowToDonate] Gagal mengirim panduan:', err);
      await interaction
        .followUp({
          content:
            '⚠️ Gagal mengirim panduan. Pastikan file gambar ada di folder `assets/how-to-donate/` ' +
            'dan bot punya izin Send Messages, Embed Links & Attach Files di channel ini.',
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }
  },
};
