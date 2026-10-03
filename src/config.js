import 'dotenv/config';

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  mtaHost: process.env.MTA_HOST || '151.242.227.118',
  mtaPort: Number(process.env.MTA_PORT || 22003),
  serverName: process.env.SERVER_NAME || 'Brasil Mega Lite',
  verifiedRoleId: process.env.VERIFIED_ROLE_ID || '',
  verificationChannelId: process.env.VERIFICATION_CHANNEL_ID || '',
  panelChannelId: process.env.PANEL_CHANNEL_ID || '',
  panelRefreshSeconds: Math.max(30, Number(process.env.PANEL_REFRESH_SECONDS || 30)),
};

export function validateConfig() {
  const missing = [];
  if (!config.token) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('CLIENT_ID');
  if (!config.guildId) missing.push('GUILD_ID');
  if (missing.length) throw new Error(`Preencha no arquivo .env: ${missing.join(', ')}`);
}
