function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const config = {
  discord: {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    guildId: process.env['DISCORD_GUILD_ID'] || null,
  },
  ws: {
    port: parseInt(optional('WS_PORT', '9393'), 10),
  },
  vlc: {
    host: optional('VLC_HOST', 'localhost'),
    port: parseInt(optional('VLC_PORT', '8080'), 10),
    password: process.env['VLC_PASSWORD'] || '',
  },
  actionLogEnabled: optional('ACTION_LOG_ENABLED', 'true') === 'true',
  streamerUserId: process.env['STREAMER_USER_ID'] || null,
} as const;
