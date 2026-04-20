import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type User,
} from 'discord.js';
import type { PlaybackState } from '../providers/types.js';

const COLOR_PLAYING = 0xe74c3c;
const COLOR_PAUSED = 0x95a5a6;
const PROGRESS_BAR_LENGTH = 20;

export function buildProgressBar(current: number, total: number, length = PROGRESS_BAR_LENGTH): string {
  if (total <= 0) return '━'.repeat(length);
  const filled = Math.round((current / total) * length);
  const empty = length - filled;
  return '━'.repeat(filled) + '●' + '━'.repeat(Math.max(0, empty - 1));
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function capitalizeSource(source: string): string {
  const map: Record<string, string> = {
    netflix: 'Netflix',
    hotstar: 'Hotstar',
    prime: 'Prime Video',
    vlc: 'VLC',
  };
  return map[source] ?? source;
}

export function buildNowPlayingEmbed(
  state: PlaybackState | null,
  streamer: User,
  sessionStart: Date
): EmbedBuilder {
  const embed = new EmbedBuilder().setTimestamp(sessionStart);

  if (!state) {
    return embed
      .setTitle('🎬  NOW STREAMING')
      .setDescription('Waiting for a video source...')
      .setColor(COLOR_PAUSED)
      .setFooter({ text: `Streamed by ${streamer.displayName}`, iconURL: streamer.displayAvatarURL() });
  }

  const bar = buildProgressBar(state.currentTime, state.duration);
  const position = `${formatTime(state.currentTime)} ${bar} ${formatTime(state.duration)}`;
  const statusIcon = state.paused ? '⏸' : '▶';
  const statusText = state.paused ? 'Paused' : 'Playing';

  return embed
    .setTitle('🎬  NOW STREAMING')
    .setDescription(`**${state.title}**\n\n\`${position}\``)
    .setColor(state.paused ? COLOR_PAUSED : COLOR_PLAYING)
    .addFields(
      { name: 'Source', value: capitalizeSource(state.source), inline: true },
      { name: 'Status', value: `${statusIcon} ${statusText}`, inline: true },
    )
    .setFooter({ text: `Streamed by ${streamer.displayName}`, iconURL: streamer.displayAvatarURL() });
}

export function buildButtonRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('rewind_10')
      .setLabel('⏪ 10s')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('playpause')
      .setLabel('⏯')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('forward_10')
      .setLabel('10s ⏩')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('switch_source')
      .setLabel('🔀')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('end_session')
      .setLabel('🛑 End')
      .setStyle(ButtonStyle.Danger),
  );
}
