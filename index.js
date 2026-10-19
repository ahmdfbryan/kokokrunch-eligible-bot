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
const storePanelCommand = require('./src/commands/storePanel');
const storeToggleCommand = require('./src/commands/storeToggle');
const goldDonationCommand = require('./src/commands/goldDonation');
const howToDonateCommand = require('./src/commands/howToDonate');
const stickyOffCommand = require('./src/commands/stickyOff');
const danaMasukCommand = require('./src/commands/danaMasuk');
const statistikStoreCommand = require('./src/commands/statistikStore');
const { checkEligibilityEmbed } = require('./src/services/eligibilityCheck');
const { registerPanelPayloadBuilder, scheduleStickyRepost } = require('./src/services/stickyPanelManager');
const { syncFromResult } = require('./src/services/watchlistStore');
const { startWatchlistScheduler } = require('./src/services/watchlistScheduler');
const rolePanel = require('./src/services/rolePanelAutoSetup');
const storeFlow = require('./src/services/storeFlow');
const ticketStore = require('./src/services/ticketStore');
const { refreshStorePanels } = require('./src/services/storePanelRefresh');

const CHECK_ACCOUNT_MODAL_ID = 'panel_cek_akun_modal';
const CHECK_ACCOUNT_USERNAME_INPUT_ID = 'roblox_username';

registerPanelPayloadBuilder(panelCommand.buildPanelPayload);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.commands = new Collection();
client.commands.set(eligibleCommand.data.name, eligibleCommand);
client.commands.set(panelCommand.data.name, panelCommand);
client.commands.set(storePanelCommand.data.name, storePanelCommand);
client.commands.set(storeToggleCommand.data.name, storeToggleCommand);
client.commands.set(goldDonationCommand.data.name, goldDonationCommand);
client.commands.set(howToDonateCommand.data.name, howToDonateCommand);
client.commands.set(stickyOffCommand.data.name, stickyOffCommand);
client.commands.set(danaMasukCommand.data.name, danaMasukCommand);
client.commands.set(statistikStoreCommand.data.name, statistikStoreCommand);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`[Bot] Login berhasil sebagai ${readyClient.user.tag}`);
  console.log(`[Bot] Memantau komunitas Roblox group ID: ${config.robloxGroupId}`);
  console.log(`[Bot] Ambang batas eligible: ${config.eligibleDays} hari`);

  startWatchlistScheduler(readyClient);
  rolePanel.ensureRolePanelsPosted(readyClient);

  // Refresh panel Store yang sudah terkirim (status Buka/Tutup + ubah dropdown lama jadi tombol produk).
  refreshStorePanels(readyClient).catch((err) => console.error('[Store] Gagal refresh panel saat startup:', err));
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
        .setPlaceholder('Contoh: usernamekamu')
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

      const guildIconUrl = interaction.guild?.iconURL({ size: 128 }) || null;
      const botAvatarUrl = interaction.client.user.displayAvatarURL({ size: 128 });

      await interaction.deferReply();
      const { embed, result } = await checkEligibilityEmbed(inputUsername, { guildIconUrl, botAvatarUrl });
      const components = result?.status === 'not_joined' ? [panelCommand.buildCommunityLinkRow()] : [];
      await interaction.editReply({ embeds: [embed], components });

      syncFromResult(result, { channelId: interaction.channelId, discordUserId: interaction.user.id });

      scheduleStickyRepost(client, interaction.channelId);
      return;
    }

    // --- Klik tombol Gender / Game -> toggle role milik member yang klik ---
    if (interaction.isButton() && rolePanel.ROLE_ID_BY_BUTTON[interaction.customId]) {
      const roleId = rolePanel.ROLE_ID_BY_BUTTON[interaction.customId];
      const roleName = rolePanel.ROLE_LABEL_BY_BUTTON[interaction.customId];
      const member = interaction.member;
      const hasRole = member.roles.cache.has(roleId);
      const guildIconUrl = interaction.guild?.iconURL({ size: 128 }) || null;

      if (hasRole) {
        await member.roles.remove(roleId);
        await interaction.reply({
          embeds: [rolePanel.buildRoleToggleEmbed({ added: false, guildIconUrl, roleName })],
          ephemeral: true,
        });
      } else {
        await member.roles.add(roleId);
        await interaction.reply({
          embeds: [rolePanel.buildRoleToggleEmbed({ added: true, guildIconUrl, roleName })],
          ephemeral: true,
        });
      }
      return;
    }

    // --- How to Donate: tombol "Translate to English" ---
    if (interaction.isButton() && interaction.customId === howToDonateCommand.TRANSLATE_BUTTON_ID) {
      await howToDonateCommand.handleTranslateButton(interaction);
      return;
    }

    // --- Store: klik tombol produk di panel ---
    if (interaction.isButton() && interaction.customId.startsWith(storePanelCommand.STORE_PRODUCT_BUTTON_PREFIX)) {
      await storeFlow.handleProductSelect(interaction);
      return;
    }

    // --- Store: pilih produk di dropdown (panel lama, sebelum ter-refresh jadi tombol) ---
    if (interaction.isStringSelectMenu() && interaction.customId === storePanelCommand.STORE_SELECT_MENU_ID) {
      await storeFlow.handleProductSelect(interaction);
      return;
    }

    // --- Store: submit modal username Roblox (habis pilih produk) ---
    if (interaction.isModalSubmit() && interaction.customId.startsWith(storeFlow.USERNAME_MODAL_PREFIX)) {
      await storeFlow.handleUsernameModalSubmit(interaction);
      return;
    }

    // --- Store: klik tombol Ya/Tidak konfirmasi akun Roblox ---
    if (
      interaction.isButton() &&
      (interaction.customId === storeFlow.CONFIRM_YES_ID || interaction.customId === storeFlow.CONFIRM_NO_ID)
    ) {
      await storeFlow.handleConfirmButton(interaction);
      return;
    }

    // --- Store: klik tombol "Konfirmasi Pembayaran" di dalam channel ticket (staff/owner) ---
    if (interaction.isButton() && interaction.customId === storeFlow.CONFIRM_PAYMENT_BUTTON_ID) {
      await storeFlow.handleConfirmPaymentButton(interaction);
      return;
    }

    // --- Store: klik tombol "Tutup Ticket" di dalam channel ticket -> tampilkan dropdown status ---
    if (interaction.isButton() && interaction.customId === storeFlow.CLOSE_TICKET_BUTTON_ID) {
      await storeFlow.handleCloseButton(interaction);
      return;
    }

    // --- Store: pilih status di dropdown penutupan ticket -> tampilkan modal catatan ---
    if (interaction.isStringSelectMenu() && interaction.customId === storeFlow.CLOSE_SELECT_ID) {
      await storeFlow.handleCloseSelect(interaction);
      return;
    }

    // --- Store: submit modal catatan penutupan ticket ---
    if (interaction.isModalSubmit() && interaction.customId.startsWith(storeFlow.CLOSE_MODAL_PREFIX)) {
      await storeFlow.handleCloseModalSubmit(interaction);
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

client.on(Events.MessageCreate, (message) => {
  if (message.author.id === client.user.id) return;
  scheduleStickyRepost(client, message.channelId);
});

// --- Store: kalau channel ticket dihapus manual (bukan via tombol "Tutup Ticket"),
// otomatis tutup record ticket-nya supaya buyer tidak nyangkut dianggap masih aktif.
client.on(Events.ChannelDelete, (channel) => {
  try {
    ticketStore.forceCloseIfOrphaned(channel.id);
  } catch (err) {
    console.error('[Store] Gagal auto-close ticket saat channel dihapus manual:', err);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[Bot] Unhandled promise rejection:', reason);
});

client.login(config.discordToken);
