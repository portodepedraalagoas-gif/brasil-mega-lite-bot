import { EmbedBuilder } from 'discord.js';
import { queryMta } from './mta.js';
import { config } from '../config.js';

let panelMessageId = null;
let panelChannelId = null;

async function makeEmbed() {
  try {
    const s = await queryMta();
    return new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`🟢 ${config.serverName} — ONLINE`)
      .setDescription('Painel atualizado automaticamente.')
      .addFields(
        { name: '👥 Jogadores', value: `**${s.players}/${s.max_players}**`, inline: true },
        { name: '🎮 Gamemode', value: s.gamemode || 'Não informado', inline: true },
        { name: '🗺️ Mapa', value: s.map || 'Não informado', inline: true },
        { name: '🌐 Conectar', value: `\`${config.mtaHost}:${config.mtaPort}\``, inline: false },
        { name: '🧩 Versão', value: s.version || 'Não informada', inline: true },
        { name: '🔒 Senha', value: s.private ? 'Sim' : 'Não', inline: true },
      ).setFooter({ text: `Atualização automática • ${config.panelRefreshSeconds}s` }).setTimestamp();
  } catch {
    return new EmbedBuilder().setColor(0xe74c3c).setTitle(`🔴 ${config.serverName} — SEM RESPOSTA`)
      .setDescription('O servidor MTA não respondeu à consulta de status.')
      .addFields({ name: '🌐 IP', value: `\`${config.mtaHost}:${config.mtaPort}\`` }).setTimestamp();
  }
}

export async function upsertStatusPanel(client, channelOverride = null) {
  const channel = channelOverride || (config.panelChannelId ? await client.channels.fetch(config.panelChannelId) : null);
  if (!channel?.isTextBased()) return;
  panelChannelId = channel.id;
  const embed = await makeEmbed();
  if (panelMessageId) {
    try {
      const old = await channel.messages.fetch(panelMessageId);
      await old.edit({ embeds: [embed] });
      return;
    } catch { panelMessageId = null; }
  }
  const msg = await channel.send({ embeds: [embed] });
  panelMessageId = msg.id;
}

let updaterStarted = false;

export function startPanelUpdater(client) {
  if (updaterStarted) return;
  updaterStarted = true;

  // Se PANEL_CHANNEL_ID estiver configurado, cria/recupera o painel ao ligar.
  if (config.panelChannelId) upsertStatusPanel(client).catch(console.error);

  // O timer continua ativo mesmo quando o painel foi criado manualmente com /painel.
  // Assim que /painel definir panelChannelId/panelMessageId, a mesma mensagem passa a ser editada.
  setInterval(() => {
    if (!panelChannelId && !config.panelChannelId) return;
    upsertStatusPanel(client).catch(console.error);
  }, config.panelRefreshSeconds * 1000);
}

