import { REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { commands } from './commands.js';

const rest = new REST({ version: '10' }).setToken(config.discord.token);

const body = commands.map((cmd) => cmd.toJSON());

async function deploy() {
  try {
    console.log(`[Deploy] Registering ${body.length} slash commands...`);

    if (config.discord.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body }
      );
      console.log(`[Deploy] Registered to guild ${config.discord.guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(config.discord.clientId), { body });
      console.log('[Deploy] Registered globally (may take up to 1 hour to propagate)');
    }
  } catch (err) {
    console.error('[Deploy] Failed:', err);
    process.exit(1);
  }
}

deploy();
