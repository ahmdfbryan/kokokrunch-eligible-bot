const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const config = require('./src/config');
const eligibleCommand = require('./src/commands/eligible');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();
client.commands.set(eligibleCommand.data.name, eligibleCommand);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`[Bot] Login berhasil sebagai ${readyClient.user.tag}`);
  console.log(`[Bot] Memantau komunitas Roblox group ID: ${config.robloxGroupId}`);
  console.log(`[Bot] Ambang batas eligible: ${config.eligibleDays} hari`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[Bot] Error tak terduga di command "${interaction.commandName}":`, err);
    const errorPayload = { content: 'Terjadi kesalahan saat menjalankan command ini.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorPayload).catch(() => {});
    } else {
      await interaction.reply(errorPayload).catch(() => {});
    }
  }
});

// Supaya proses tidak langsung mati kalau ada error async yang tidak tertangkap --
// biarkan pm2/systemd yang tahu lewat log, tapi bot tetap coba jalan terus.
process.on('unhandledRejection', (reason) => {
  console.error('[Bot] Unhandled promise rejection:', reason);
});

client.login(config.discordToken);
