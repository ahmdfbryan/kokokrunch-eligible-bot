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
const { registerPanelPayloadBuilder, scheduleStickyRepost } = require('./src/services/stickyPanelManager');

const CHECK_ACCOUNT_MODAL_ID = 'panel_cek_akun_modal';
const CHECK_ACCOUNT_USERNAME_INPUT_ID = 'roblox_username';

// Kenalkan ke stickyPanelManager cara membangun ulang isi panel saat repost.
registerPanelPayloadBuilder(panelCommand.buildPanelPayload);

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

      const guildIconUrl = interaction.guild?.iconURL({ size: 128 }) || null;
      const botAvatarUrl = interaction.client.user.displayAvatarURL({ size: 128 });

      await interaction.deferReply();
      const embed = await checkEligibilityEmbed(inputUsername, { guildIconUrl, botAvatarUrl });
      await interaction.editReply({ embeds: [embed] });

      // Panel ikut "turun" ke bawah hasil pengecekan ini.
      scheduleStickyRepost(client, interaction.channelId);
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
  // Abaikan pesan dari bot ini sendiri -- termasuk pesan panel hasil repost
  // ITU SENDIRI (mencegah infinite loop). Hasil pengecekan eligibility dari
  // /eligible & tombol "Cek Akun Anda" sengaja TIDAK ditangani lewat sini,
  // tapi dipicu manual (lihat scheduleStickyRepost di eligible.js & di atas)
  // supaya tidak perlu menebak-nebak lewat event ini.
  if (message.author.id === client.user.id) return;

  scheduleStickyRepost(client, message.channelId);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Bot] Unhandled promise rejection:', reason);
});

client.login(config.discordToken);
