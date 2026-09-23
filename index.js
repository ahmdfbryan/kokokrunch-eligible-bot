const {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const config = require('./src/config');
const eligibleCommand = require('./src/commands/eligible');
const panelCommand = require('./src/commands/panel');
const { checkEligibilityEmbed } = require('./src/services/eligibilityCheck');
const { readStickyPanel, writeStickyPanel } = require('./src/services/stickyPanelStore');

const CHECK_ACCOUNT_MODAL_ID = 'panel_cek_akun_modal';
const CHECK_ACCOUNT_USERNAME_INPUT_ID = 'roblox_username';

const STICKY_REPOST_DEBOUNCE_MS = 1500;
const stickyRepostTimers = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

client.commands = new Collection();
client.commands.set(eligibleCommand.data.name, eligibleCommand);
client.commands.set(panelCommand.data.name, panelCommand);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`[Bot] Login berhasil sebagai ${readyClient.user.tag}`);
  console.log(`[Bot] Memantau komunitas Roblox group ID: ${config.robloxGroupId}`);
  console.log(`[Bot] Ambang batas eligible: ${config.eligibleDays} hari`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId === panelCommand.CHECK_ACCOUNT_BUTTON_ID) {
      const modal = new ModalBuilder()
        .setCustomId(CHECK_ACCOUNT_MODAL_ID)
        .setTitle('Cek Status Akun Roblox');

      const usernameInput = new TextInputBuilder()
        .setCustomId(CHECK_ACCOUNT_USERNAME_INPUT_ID)
        .setLabel('Username Roblox kamu')
        .setPlaceholder('Contoh: ahmdfbryan')
        .setStyle(TextInputStyle.Short)
        .setMinLength(3)
        .setMaxLength(50)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(usernameInput));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === CHECK_ACCOUNT_MODAL_ID) {
      const inputUsername = interaction.fields
        .getTextInputValue(CHECK_ACCOUNT_USERNAME_INPUT_ID)
        .trim();

      await interaction.deferReply();
      const embed = await checkEligibilityEmbed(inputUsername);
      await interaction.editReply({ embeds: [embed] });
      return;
    }
  } catch (err) {
    console.error(`[Bot] Error tak terduga saat menangani interaction (${interaction.type}):`, err);
    const errorPayload = { content: 'Terjadi kesalahan saat memproses permintaan ini.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(errorPayload).catch(() => {});
    } else if (interaction.isRepliable()) {
      await interaction.reply(errorPayload).catch(() => {});
    }
  }
});

async function repostStickyPanel(channelId) {
  const sticky = readStickyPanel();
  if (!sticky || sticky.channelId !== channelId) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return;

    try {
      const oldMessage = await channel.messages.fetch(sticky.messageId);
      await oldMessage.delete();
    } catch (err) {
      console.warn(`[StickyPanel] Tidak bisa hapus panel lama (${sticky.messageId}): ${err.message}`);
    }

    const newMessage = await channel.send(panelCommand.buildPanelPayload());
    writeStickyPanel({ channelId, messageId: newMessage.id });
  } catch (err) {
    console.error(`[StickyPanel] Gagal repost panel di channel ${channelId}:`, err);
  }
}

client.on(Events.MessageCreate, (message) => {
  // Abaikan pesan dari bot ini sendiri (termasuk pesan panel hasil repost).
  // PENTING: ini dicek berdasarkan siapa pengirimnya, BUKAN berdasarkan
  // message ID yang tersimpan -- karena event pesan baru dari Discord kadang
  // sampai lebih cepat daripada kita sempat menyimpan ID panel yang baru,
  // yang sebelumnya bikin bot salah kira panel sendiri sebagai "pesan baru
  // dari luar" lalu terus-menerus hapus & kirim ulang (makanya kelihatan
  // "kedip"/muncul-hilang terus).
  if (message.author.id === client.user.id) return;

  const sticky = readStickyPanel();
  if (!sticky || sticky.channelId !== message.channelId) return;

  if (stickyRepostTimers.has(message.channelId)) {
    clearTimeout(stickyRepostTimers.get(message.channelId));
  }
  const timer = setTimeout(() => {
    stickyRepostTimers.delete(message.channelId);
    repostStickyPanel(message.channelId).catch((err) =>
      console.error('[StickyPanel] Unhandled error saat repost:', err)
    );
  }, STICKY_REPOST_DEBOUNCE_MS);
  stickyRepostTimers.set(message.channelId, timer);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Bot] Unhandled promise rejection:', reason);
});

client.login(config.discordToken);
