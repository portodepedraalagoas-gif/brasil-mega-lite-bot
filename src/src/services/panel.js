import {discordPause} from './discordPause.js';
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

async function updatePanel(client, channelOverride = null) {
  const channel = channelOverride || (config.panelChannelId ? await client.channels.fetch(config.panelChannelId) : null);
  if (!channel?.isTextBased()) return;
  panelChannelId = channel.id;
  const embed = await makeEmbed();
  if (panelMessageId) {
    try {
      const old = await channel.messages.fetch(panelMessageId);
      await old.edit({ embeds: [embed] });
      return;
    } catch(error) {
      if(error.code===10008)panelMessageId=null;
      else throw error;
    }
  }
  const msg = await channel.send({ embeds: [embed] });
  panelMessageId = msg.id;
}

let updaterStarted=false,busy=false,nextAttempt=0;
export async function upsertStatusPanel(client,channelOverride=null) {
 if(busy || Date.now()<nextAttempt || !client.isReady())return;
 busy=true;
 try{
  if(await discordPause.remaining()>0)return;
  return await updatePanel(client,channelOverride);
 }
 catch(error){
  nextAttempt=Date.now()+([50001,50013].includes(error.code)?1800000:60000);
  throw error;
 }finally{busy=false;}
}
export function startPanelUpdater(client) {
 if(updaterStarted)return;updaterStarted=true;
 const configured=Number(config.panelRefreshSeconds);
 const delay=(Number.isFinite(configured)&&configured>=30?configured:60)*1000;
 const update=()=>{
  if(!panelChannelId&&!config.panelChannelId)return;
  upsertStatusPanel(client).catch(e=>console.error('[BML Painel] Atualização adiada:',e.code||e.name));
 };
 update();setInterval(update,delay).unref();
}
