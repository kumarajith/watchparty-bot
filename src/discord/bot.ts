import {
  Client,
  GatewayIntentBits,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  Message,
  type TextChannel,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ActionRowBuilder,
  ComponentType,
} from 'discord.js';
import { config } from '../config.js';
import type { Orchestrator } from '../orchestrator/orchestrator.js';
import { buildNowPlayingEmbed, buildButtonRow } from './embeds.js';

interface ActiveSession {
  channelId: string;
  messageId: string;
  streamerId: string;
  startedAt: Date;
  refreshInterval: ReturnType<typeof setInterval> | null;
}

export class DiscordBot {
  private client: Client;
  private session: ActiveSession | null = null;

  constructor(private orchestrator: Orchestrator) {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isChatInputCommand()) {
        await this.handleCommand(interaction);
      } else if (interaction.isButton()) {
        await this.handleButton(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await this.handleSelectMenu(interaction);
      }
    });

    this.client.once('ready', () => {
      console.log(`[Discord] Logged in as ${this.client.user?.tag}`);
    });
  }

  async start(): Promise<void> {
    await this.client.login(config.discord.token);
  }

  async destroy(): Promise<void> {
    this.stopRefreshInterval();
    this.client.destroy();
  }

  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const name = interaction.commandName;

    switch (name) {
      case 'go-live':
        return this.cmdGoLive(interaction);
      case 'end':
        return this.cmdEnd(interaction);
      case 'pause':
        return this.cmdPause(interaction);
      case 'play':
        return this.cmdPlay(interaction);
      case 'rewind':
        return this.cmdRewind(interaction);
      case 'forward':
        return this.cmdForward(interaction);
      case 'np':
        return this.cmdNowPlaying(interaction);
      case 'source':
        return this.cmdSource(interaction);
      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  }

  // ── Slash Commands ──────────────────────────────────────────────

  private async cmdGoLive(interaction: ChatInputCommandInteraction): Promise<void> {
    if (this.session) {
      await interaction.reply({ content: 'A session is already active. Use `/end` first.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const state = await this.orchestrator.getActiveState();
    const startedAt = new Date();
    const embed = buildNowPlayingEmbed(state, interaction.user, startedAt);
    const row = buildButtonRow();

    const reply = await interaction.editReply({ embeds: [embed], components: [row] });

    this.session = {
      channelId: interaction.channelId,
      messageId: reply.id,
      streamerId: interaction.user.id,
      startedAt,
      refreshInterval: null,
    };

    this.startRefreshInterval();
  }

  private async cmdEnd(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!this.session) {
      await interaction.reply({ content: 'No active session.', ephemeral: true });
      return;
    }

    this.stopRefreshInterval();

    try {
      const channel = await this.client.channels.fetch(this.session.channelId) as TextChannel;
      const msg = await channel.messages.fetch(this.session.messageId);
      await msg.edit({ components: [] });
    } catch {
      // Embed might already be deleted
    }

    this.session = null;
    await interaction.reply({ content: '🛑 Movie night ended.', ephemeral: false });
  }

  private async cmdPause(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await this.orchestrator.pause();
      await interaction.reply({ content: '⏸ Paused.', ephemeral: true });
      await this.logAction(interaction, '⏸ paused playback');
      await this.refreshEmbed();
    } catch (err) {
      await interaction.reply({ content: `Failed: ${(err as Error).message}`, ephemeral: true });
    }
  }

  private async cmdPlay(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await this.orchestrator.play();
      await interaction.reply({ content: '▶ Playing.', ephemeral: true });
      await this.logAction(interaction, '▶ resumed playback');
      await this.refreshEmbed();
    } catch (err) {
      await interaction.reply({ content: `Failed: ${(err as Error).message}`, ephemeral: true });
    }
  }

  private async cmdRewind(interaction: ChatInputCommandInteraction): Promise<void> {
    const seconds = interaction.options.getInteger('seconds') ?? 10;
    try {
      await this.orchestrator.seekRelative(-seconds);
      await interaction.reply({ content: `⏪ Rewound ${seconds}s.`, ephemeral: true });
      await this.logAction(interaction, `⏪ rewound ${seconds}s`);
      await this.refreshEmbed();
    } catch (err) {
      await interaction.reply({ content: `Failed: ${(err as Error).message}`, ephemeral: true });
    }
  }

  private async cmdForward(interaction: ChatInputCommandInteraction): Promise<void> {
    const seconds = interaction.options.getInteger('seconds') ?? 10;
    try {
      await this.orchestrator.seekRelative(seconds);
      await interaction.reply({ content: `⏩ Forwarded ${seconds}s.`, ephemeral: true });
      await this.logAction(interaction, `⏩ skipped forward ${seconds}s`);
      await this.refreshEmbed();
    } catch (err) {
      await interaction.reply({ content: `Failed: ${(err as Error).message}`, ephemeral: true });
    }
  }

  private async cmdNowPlaying(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!this.session) {
      await interaction.reply({ content: 'No active session. Use `/go-live` first.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const streamer = await this.client.users.fetch(this.session.streamerId);
    const state = await this.orchestrator.getActiveState();
    const embed = buildNowPlayingEmbed(state, streamer, this.session.startedAt);
    const row = buildButtonRow();

    // Delete old embed
    try {
      const channel = await this.client.channels.fetch(this.session.channelId) as TextChannel;
      const oldMsg = await channel.messages.fetch(this.session.messageId);
      await oldMsg.delete();
    } catch {
      // Old message might not exist
    }

    const reply = await interaction.editReply({ embeds: [embed], components: [row] });
    this.session.messageId = reply.id;
    this.session.channelId = interaction.channelId;
  }

  private async cmdSource(interaction: ChatInputCommandInteraction): Promise<void> {
    const sessions = await this.orchestrator.discoverAll();
    if (sessions.length === 0) {
      await interaction.reply({ content: 'No active sources found.', ephemeral: true });
      return;
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('source_select')
      .setPlaceholder('Pick a source')
      .addOptions(
        sessions.map((s) => ({
          label: `${s.state.title}`,
          description: `${s.state.source} — ${s.state.paused ? 'Paused' : 'Playing'}`,
          value: s.sessionId,
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
    const reply = await interaction.reply({ content: 'Select a source:', components: [row], ephemeral: true });
    const msg = reply instanceof Message ? reply : await interaction.fetchReply();

    try {
      const collected = await msg.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 30_000,
      }) as StringSelectMenuInteraction;

      this.orchestrator.setActiveSession(collected.values[0]);
      await collected.update({ content: `Source set to **${collected.values[0]}**.`, components: [] });
      await this.refreshEmbed();
    } catch {
      await interaction.editReply({ content: 'Selection timed out.', components: [] });
    }
  }

  // ── Button Interactions ─────────────────────────────────────────

  private async handleButton(interaction: ButtonInteraction): Promise<void> {
    if (!this.session) {
      await interaction.reply({ content: 'No active session.', ephemeral: true });
      return;
    }

    await interaction.deferUpdate();

    try {
      switch (interaction.customId) {
        case 'rewind_10':
          await this.orchestrator.seekRelative(-10);
          await this.logAction(interaction, '⏪ rewound 10s');
          break;
        case 'playpause': {
          const state = await this.orchestrator.getActiveState();
          if (state?.paused) {
            await this.orchestrator.play();
            await this.logAction(interaction, '▶ resumed playback');
          } else {
            await this.orchestrator.pause();
            await this.logAction(interaction, '⏸ paused playback');
          }
          break;
        }
        case 'forward_10':
          await this.orchestrator.seekRelative(10);
          await this.logAction(interaction, '⏩ skipped forward 10s');
          break;
        case 'refresh':
          await this.logAction(interaction, '🔄 refreshed');
          break;
      }
    } catch (err) {
      console.error('[Discord] Button handler error:', (err as Error).message);
    }

    // Brief delay for state propagation, then refresh
    await delay(200);
    await this.refreshEmbed();
  }

  private async handleSelectMenu(_interaction: StringSelectMenuInteraction): Promise<void> {
    // Handled in cmdSource via collector
  }

  // ── Embed Refresh ───────────────────────────────────────────────

  private async refreshEmbed(): Promise<void> {
    if (!this.session) return;

    try {
      const channel = await this.client.channels.fetch(this.session.channelId) as TextChannel;
      const msg = await channel.messages.fetch(this.session.messageId);
      const streamer = await this.client.users.fetch(this.session.streamerId);
      const state = await this.orchestrator.getActiveState();
      const embed = buildNowPlayingEmbed(state, streamer, this.session.startedAt);
      const row = buildButtonRow();
      await msg.edit({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('[Discord] Embed refresh failed:', (err as Error).message);
    }
  }

  private startRefreshInterval(): void {
    this.stopRefreshInterval();
    if (this.session) {
      this.session.refreshInterval = setInterval(() => {
        this.refreshEmbed().catch((err) => {
          console.error('[Discord] Periodic refresh error:', err);
        });
      }, 30_000);
    }
  }

  private stopRefreshInterval(): void {
    if (this.session?.refreshInterval) {
      clearInterval(this.session.refreshInterval);
      this.session.refreshInterval = null;
    }
  }

  // ── Action Log ──────────────────────────────────────────────────

  private async logAction(
    interaction: ChatInputCommandInteraction | ButtonInteraction,
    action: string
  ): Promise<void> {
    if (!config.actionLogEnabled || !this.session) return;

    try {
      const channel = await this.client.channels.fetch(this.session.channelId) as TextChannel;
      await channel.send(`${action} — <@${interaction.user.id}>`);
    } catch {
      // Non-critical, ignore
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
