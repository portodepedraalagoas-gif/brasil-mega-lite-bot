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
  ticketPanelChannelId: process.env.TICKET_PANEL_CHANNEL_ID || '1555911142700884028',
  ticketCategoryId: process.env.TICKET_CATEGORY_ID || '1555911990155677848',
  staffRoleId: process.env.STAFF_ROLE_ID || '1554536183457906709',
  reportRoleId: process.env.REPORT_ROLE_ID || '1555910336820027472',
  financeRoleId: process.env.FINANCE_ROLE_ID || '1555912138151960656',
  reportAcceptedChannelId: process.env.REPORT_ACCEPTED_CHANNEL_ID || '1555909005862248498',
  reportDeniedChannelId: process.env.REPORT_DENIED_CHANNEL_ID || '1555909063219355678',
  automodLogChannelId: process.env.AUTOMOD_LOG_CHANNEL_ID || '',
// ==========================================
// INTEGRAÇÃO MTA ↔ DISCORD
// ==========================================

mtaApiKey: process.env.MTA_API_SECRET || '',
mtaApiPort: Number(process.env.PORT || 3000),
mtaVerificationEnabled: process.env.MTA_VERIFICATION_ENABLED === 'true',
  
};

export function validateConfig() {
  const missing=[];
  if(!config.token) missing.push('DISCORD_TOKEN');
  if(!config.clientId) missing.push('CLIENT_ID');
  if(!config.guildId) missing.push('GUILD_ID');
  if(missing.length) throw new Error(`Preencha no arquivo .env: ${missing.join(', ')}`);
}
