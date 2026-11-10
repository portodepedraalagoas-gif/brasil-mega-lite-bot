import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('ip')
  .setDescription('Mostra o IP para entrar no Brasil Mega Lite.');

export async function execute(interaction) {
  const ip = `${config.mtaHost}:${config.mtaPort}`;
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🌐 ${config.serverName}`)
    .setDescription(`Abra o **MTA:SA** → **Quick Connect / Conexão rápida** e cole:\n\n\`${ip}\`\n\nAtalho MTA: \`mtasa://${ip}\``)
    .setFooter({ text: 'Brasil Mega Lite • MTA:SA' });
  let connectUrl = 'https://brasil-mega-lite-bot-production.up.railway.app/conectar';
  const publicUrl = process.env.MTA_CONNECT_BASE_URL?.trim() || process.env.TRANSCRIPT_BASE_URL?.trim();
  if (publicUrl) {
    try {
      const url = new URL('/conectar', publicUrl);
      if (url.protocol === 'https:' && !url.username && !url.password) connectUrl = url.href;
    } catch {
      // Uma variável inválida não deve impedir o comando de responder.
    }
  }
  const button = new ButtonBuilder()
    .setLabel('Conectar ao servidor')
    .setStyle(ButtonStyle.Link)
    .setURL(connectUrl);
  await interaction.reply({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(button)]
  });
}
