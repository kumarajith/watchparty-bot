import { config } from './config.js';
import { WsServer } from './server/ws-server.js';
import { BrowserProvider } from './providers/browser-provider.js';
import { VlcProvider } from './providers/vlc-provider.js';
import { Orchestrator } from './orchestrator/orchestrator.js';
import { DiscordBot } from './discord/bot.js';

async function main() {
  // 1. WebSocket server for Chrome extension
  const wsServer = new WsServer();
  wsServer.start(config.ws.port);

  // 2. Player providers
  const browserProvider = new BrowserProvider(wsServer);
  const vlcProvider = new VlcProvider(config.vlc.host, config.vlc.port, config.vlc.password);

  // 3. Orchestrator
  const orchestrator = new Orchestrator([browserProvider, vlcProvider]);

  // 4. Discord bot
  const bot = new DiscordBot(orchestrator);
  await bot.start();

  console.log('[App] Movie Night Bot is running');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[App] Shutting down...');
    await bot.destroy();
    wsServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[App] Fatal error:', err);
  process.exit(1);
});
