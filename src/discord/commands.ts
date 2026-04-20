import { SlashCommandBuilder } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('go-live')
    .setDescription('Start a movie night session and post the Now Playing embed'),

  new SlashCommandBuilder()
    .setName('end')
    .setDescription('End the current movie night session'),

  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause playback'),

  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Resume playback'),

  new SlashCommandBuilder()
    .setName('rewind')
    .setDescription('Rewind playback')
    .addIntegerOption((opt) =>
      opt.setName('seconds').setDescription('Seconds to rewind (default: 10)').setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('forward')
    .setDescription('Fast-forward playback')
    .addIntegerOption((opt) =>
      opt.setName('seconds').setDescription('Seconds to fast-forward (default: 10)').setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('np')
    .setDescription('Re-post or refresh the Now Playing embed'),

  new SlashCommandBuilder()
    .setName('source')
    .setDescription('Show active sources and pick one'),
];
