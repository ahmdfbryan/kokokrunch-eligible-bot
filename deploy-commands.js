const { REST, Routes } = require('discord.js');
const config = require('./src/config');
const eligibleCommand = require('./src/commands/eligible');

const commands = [eligibleCommand.data.toJSON()];

const rest = new REST().setToken(config.discordToken);

(async () => {
  try {
    console.log(`[Deploy] Mendaftarkan ${commands.length} slash command...`);

    const route = config.discordGuildId
      ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
      : Routes.applicationCommands(config.discordClientId);

    await rest.put(route, { body: commands });

    if (config.discordGuildId) {
      console.log(`[Deploy] Sukses! Command terdaftar khusus di guild ${config.discordGuildId} (instan).`);
    } else {
      console.log('[Deploy] Sukses! Command terdaftar global (bisa butuh ~1 jam untuk tampil di semua server).');
    }
  } catch (err) {
    console.error('[Deploy] Gagal mendaftarkan command:', err);
    process.exit(1);
  }
})();
